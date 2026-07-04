// Pure normalization of the LLM's raw draft into a strict RecipeDraft. The LLM
// is prompted to follow the rules, but we never trust it: numbers are clamped,
// units are aliased, tags are intersected with the allowed set, and the whole
// thing is re-validated with the strict zod schema at the end.
import { z } from "zod";
import { roundAmount } from "../grocery";
import { recipeDraftSchema, type RecipeDraft, type UnitCode } from "./schema";
import { importError } from "./errors";

const UNIT_ALIASES: Record<string, UnitCode> = {
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  fl_oz: "fl_oz",
  "fl oz": "fl_oz",
  "fluid ounce": "fl_oz",
  "fluid ounces": "fl_oz",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  item: "item",
  each: "item",
  piece: "item",
  pieces: "item",
  whole: "item",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
};

// Never reject an import over a unit — unresolvable units become "item".
export function clampUnitCode(u: string): UnitCode {
  const key = String(u ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  return UNIT_ALIASES[key] ?? "item";
}

export function normalizeAmount(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return roundAmount(v); // shared 3-decimal rounding with grocery generation
}

export function normalizeServings(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return 4;
  const clamped = Math.min(24, Math.max(1, v));
  return Math.round(clamped * 2) / 2; // nearest 0.5
}

// Case-insensitive intersection with the allowed vocabulary, canonical casing,
// deduped, capped at 5.
export function sanitizeTags(raw: string[], allowed: string[]): string[] {
  const canonical = new Map<string, string>();
  for (const a of allowed) canonical.set(a.toLowerCase().trim(), a);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw ?? []) {
    if (typeof r !== "string") continue;
    const canon = canonical.get(r.toLowerCase().trim());
    if (canon && !seen.has(canon)) {
      seen.add(canon);
      out.push(canon);
      if (out.length >= 5) break;
    }
  }
  return out;
}

// Key on (lower(name), unit_code); keep the first occurrence.
export function dedupeIngredients<T extends { name: string; unit_code: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = `${row.name.toLowerCase()}|${row.unit_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

// Strip leading step numbering ("1. ", "1) ", "Step 1:", "Step 1 -") but NOT a
// leading numeric range like "3-4 minutes" — the negative lookahead refuses to
// strip when a digit immediately follows the delimiter.
function stripStepNumbering(step: string): string {
  return step.replace(/^\s*(?:step\s*)?\d+\s*[.):\-]\s*(?!\d)/i, "");
}

const lenientIngredient = z.object({
  name: z.string().catch(""),
  amount: z.coerce.number().catch(0),
  unit_code: z.string().catch("item"),
  is_pantry_staple: z.boolean().catch(false),
});

const lenientDraft = z
  .object({
    name: z.string().catch(""),
    base_servings: z.coerce.number().catch(4),
    tags: z.array(z.string()).catch([]),
    ingredients: z.array(lenientIngredient).catch([]),
    steps: z.array(z.string()).catch([]),
  })
  .catch({ name: "", base_servings: 4, tags: [], ingredients: [], steps: [] });

export function normalizeDraft(
  raw: unknown,
  allowedTags: string[],
  sourceUrl: string | null,
  originalText: string,
): RecipeDraft {
  const parsed = lenientDraft.parse(raw);

  const name = parsed.name.trim();
  const base_servings = normalizeServings(parsed.base_servings);
  const tags = sanitizeTags(parsed.tags, allowedTags);

  const ingredients = dedupeIngredients(
    parsed.ingredients
      .map((ing) => ({
        name: ing.name.trim(),
        amount: normalizeAmount(ing.amount),
        unit_code: clampUnitCode(ing.unit_code),
        is_pantry_staple: ing.is_pantry_staple,
      }))
      .filter((ing) => ing.name.length > 0),
  );

  const steps = parsed.steps
    .map((step) => stripStepNumbering(String(step)).trim())
    .filter((step) => step.length > 0);

  // Only two abort conditions — everything else is recoverable.
  if (!name || ingredients.length === 0) {
    throw importError("no_recipe_found");
  }

  const instructions_raw =
    (sourceUrl ? `Source: ${sourceUrl}\n\n` : "") + originalText;

  const result = recipeDraftSchema.safeParse({
    name,
    base_servings,
    instructions_raw,
    tags,
    ingredients,
    steps,
  });
  if (!result.success) {
    throw importError("llm_output_invalid");
  }
  return result.data;
}
