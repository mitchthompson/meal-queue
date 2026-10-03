// Pure helpers for the milestone 18 step-amounts backfill.
//
// IMPORT-FREE ON PURPOSE: scripts/backfill-step-amounts.mjs loads this file
// directly through Node's built-in TypeScript type stripping, which cannot
// resolve extensionless imports. Keep this file free of import statements and
// of TypeScript-only runtime syntax (no enums, namespaces, or parameter
// properties). Its vitest file may import anything.

/** Must equal IMPORT_MODEL in lib/import/anthropic.ts (asserted in the test). */
export const BACKFILL_MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type Token = { text: string; start: number; end: number };

// A token is either a word (a maximal run of Unicode letters, digits, and
// combining marks) or one single character that is neither whitespace nor
// part of a word (punctuation, symbols, parentheses, dashes, apostrophes).
// Whitespace is never a token. Matching is exact: case-sensitive, and no
// Unicode normalization (a changed accent or dash counts as a changed token).
const TOKEN_PATTERN = /[\p{L}\p{N}\p{M}]+|[^\s\p{L}\p{N}\p{M}]/gu;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    tokens.push({ text: match[0], start, end: start + match[0].length });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// The insert-only guard
// ---------------------------------------------------------------------------

export type Insertion = {
  /** Index of the original token this text follows; -1 means before the first token. */
  after: number;
  /** The inserted text exactly as it appears in the proposal. */
  text: string;
};

/** The final text in order; joining every segment's text gives `final` exactly. */
export type Segment = { text: string; inserted: boolean };

export type GuardResult =
  | { ok: true; changed: boolean; final: string; insertions: Insertion[]; segments: Segment[] }
  | { ok: false; reason: string };

export function checkInsertOnly(original: string, proposal: string): GuardResult {
  const orig = tokenize(original);
  const prop = tokenize(proposal);
  if (orig.length === 0) return { ok: false, reason: "The original step is empty." };

  // Greedy leftmost match: every original token, in order, must be found in
  // the proposal after the previous match. Success means the original is an
  // in-order subsequence of the proposal: nothing changed, dropped, or moved.
  const matchAt: number[] = [];
  let cursor = 0;
  for (let i = 0; i < orig.length; i += 1) {
    while (cursor < prop.length && prop[cursor].text !== orig[i].text) cursor += 1;
    if (cursor === prop.length) {
      return {
        ok: false,
        reason: `Original word ${i + 1} ("${orig[i].text}") is missing, changed, or out of order.`,
      };
    }
    matchAt.push(cursor);
    cursor += 1;
  }

  // Rebuild from the ORIGINAL: original tokens verbatim; each gap between two
  // original tokens keeps the original's own whitespace, unless the proposal
  // inserted tokens there, in which case that gap becomes the proposal's text
  // between the two matched tokens (the inserted words plus their spacing).
  const segments: Segment[] = [];
  const insertions: Insertion[] = [];
  for (let gap = 0; gap <= orig.length; gap += 1) {
    const firstNew = gap === 0 ? 0 : matchAt[gap - 1] + 1;
    const endNew = gap === orig.length ? prop.length : matchAt[gap];
    if (endNew > firstNew) {
      const from = gap === 0 ? 0 : prop[matchAt[gap - 1]].end;
      const to = gap === orig.length ? proposal.length : prop[matchAt[gap]].start;
      const insertStart = prop[firstNew].start;
      const insertEnd = prop[endNew - 1].end;
      const text = proposal.slice(insertStart, insertEnd);
      segments.push({ text: proposal.slice(from, insertStart), inserted: false });
      segments.push({ text, inserted: true });
      segments.push({ text: proposal.slice(insertEnd, to), inserted: false });
      insertions.push({ after: gap - 1, text });
    } else {
      const from = gap === 0 ? 0 : orig[gap - 1].end;
      const to = gap === orig.length ? original.length : orig[gap].start;
      segments.push({ text: original.slice(from, to), inserted: false });
    }
    if (gap < orig.length) segments.push({ text: orig[gap].text, inserted: false });
  }
  // Trim the whole text (save_recipe stores trimmed bodies) and drop empty
  // segments. An inserted segment starts and ends with a token, so trimming
  // only ever touches non-inserted whitespace.
  segments[0].text = segments[0].text.trimStart();
  segments[segments.length - 1].text = segments[segments.length - 1].text.trimEnd();
  const kept = segments.filter((segment) => segment.text.length > 0);
  const final = kept.map((segment) => segment.text).join("");
  return { ok: true, changed: insertions.length > 0, final, insertions, segments: kept };
}

// ---------------------------------------------------------------------------
// Insertion audit (advisory flags for the owner's review; never blocks)
// ---------------------------------------------------------------------------

export type AuditIngredient = { name: string; amount: number };

const UNIT_WORDS = new Set([
  "tsp", "teaspoon", "tbsp", "tablespoon", "cup", "c", "fl", "fluid", "oz", "ounce",
  "lb", "pound", "g", "gram", "kg", "kilogram", "ml", "milliliter", "millilitre",
  "l", "liter", "litre", "qt", "quart", "pt", "pint", "gal", "gallon", "clove",
  "slice", "item", "can", "jar", "package", "pkg", "bunch", "head", "stalk",
  "sprig", "stick", "piece", "pinch", "dash", "handful",
]);

const GLUE_WORDS = new Set([
  "of", "the", "a", "an", "and", "or", "plus", "about", "to", "taste", "divided",
  "each", "more", "for", "serving", "remaining", "half", "total", "whole",
  "large", "medium", "small", "heaping", "scant", "packed",
]);

const FRACTION_VALUES: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4,
  "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};

// Lower-cased word plus its naive singulars ("cups" -> "cup", "bunches" -> "bunch").
function wordForms(word: string): string[] {
  const w = word.toLowerCase();
  const forms = [w];
  if (w.endsWith("es")) forms.push(w.slice(0, -2));
  if (w.endsWith("s")) forms.push(w.slice(0, -1));
  return forms;
}

function isNumberWord(word: string): boolean {
  return /^[0-9½⅓⅔¼¾⅛⅜⅝⅞]+$/.test(word);
}

/** Quantities written in a text: "1 1/2", "1/2", "1.5", "½", "1½", "2". */
export function parseQuantities(text: string): number[] {
  const values: number[] = [];
  const pattern = /(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)([½⅓⅔¼¾⅛⅜⅝⅞])?|([½⅓⅔¼¾⅛⅜⅝⅞])/g;
  for (const m of text.matchAll(pattern)) {
    if (m[1] !== undefined) values.push(Number(m[1]) + Number(m[2]) / Number(m[3]));
    else if (m[4] !== undefined) values.push(Number(m[4]) / Number(m[5]));
    else if (m[6] !== undefined) values.push(Number(m[6]) + (m[7] ? FRACTION_VALUES[m[7]] : 0));
    else if (m[8] !== undefined) values.push(FRACTION_VALUES[m[8]]);
  }
  return values;
}

export function auditInsertions(insertions: Insertion[], ingredients: AuditIngredient[]): string[] {
  const ingredientWords = new Set<string>();
  const knownNumbers: number[] = [];
  for (const ingredient of ingredients) {
    for (const token of tokenize(ingredient.name)) {
      for (const form of wordForms(token.text)) ingredientWords.add(form);
    }
    if (ingredient.amount > 0) knownNumbers.push(ingredient.amount);
    knownNumbers.push(...parseQuantities(ingredient.name));
  }

  const flags: string[] = [];
  for (const insertion of insertions) {
    for (const token of tokenize(insertion.text)) {
      if (!/[\p{L}\p{N}]/u.test(token.text)) continue; // punctuation is always fine
      if (isNumberWord(token.text)) continue; // numbers are checked below
      const forms = wordForms(token.text);
      if (forms.some((f) => UNIT_WORDS.has(f) || GLUE_WORDS.has(f) || ingredientWords.has(f))) continue;
      flags.push(`Unexpected word "${token.text}" in "${insertion.text}"`);
    }
    for (const value of parseQuantities(insertion.text)) {
      if (!knownNumbers.some((n) => Math.abs(n - value) <= 0.01)) {
        flags.push(`Amount ${Number(value.toFixed(3))} in "${insertion.text}" is not in the ingredient list`);
      }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// The model call's prompt, schema, and response parsing
// ---------------------------------------------------------------------------

export const BACKFILL_SYSTEM_PROMPT = [
  "You add ingredient amounts to the steps of a recipe that a household already cooks from.",
  "",
  "You may only INSERT text. Every character of each original step must appear in your version, unchanged and in the same order. Never reword, reorder, re-punctuate, re-capitalize, fix typos, convert units, or remove anything. A step that breaks this rule is thrown away.",
  "",
  "WHAT TO INSERT. When a step uses an ingredient from the list, insert that ingredient's amount at its first mention in that step, using the amount from the list. Write it the way a cookbook would: digits and simple fractions (1/2, 1/3, 1/4, 3/4, 1 1/2); tsp, tbsp, oz, lb, g, kg, ml, l abbreviated; cup, clove, slice spelled out and pluralized when needed.",
  "",
  'WHERE. Put the amount right before the ingredient words when that reads naturally ("Season with pepper" -> "Season with 2 tsp pepper"). When the ingredient follows "the" or another word that makes that awkward, add the amount in parentheses right after the ingredient instead ("Add the garlic" -> "Add the garlic (4 cloves)"; "Add the eggs" -> "Add the eggs (3)").',
  "",
  'SKIP. Insert nothing for: an ingredient listed as "to taste"; an ingredient the step already gives an amount for; an ingredient the step does not mention; an ingredient split across steps when neither the step nor the ingredient name says how much this step uses (never guess a portion).',
  "",
  "Return every step with its step_number, in order. Return a step exactly as given when there is nothing to insert.",
].join("\n");

export type BackfillRecipe = {
  name: string;
  base_servings: number;
  ingredients: Array<{ name: string; amountText: string }>;
  steps: Array<{ step_number: number; body: string }>;
};

export function buildBackfillUserContent(recipe: BackfillRecipe): string {
  return [
    `RECIPE: ${recipe.name} (serves ${recipe.base_servings})`,
    "",
    "INGREDIENTS:",
    ...recipe.ingredients.map((ingredient) => `- ${ingredient.name}: ${ingredient.amountText}`),
    "",
    "STEPS:",
    ...recipe.steps.map((step) => `${step.step_number}. ${step.body}`),
  ].join("\n");
}

// Structured-output schema (output_config.format). Only keywords Haiku 4.5's
// structured outputs accept: no min/max, no length or array-size constraints;
// additionalProperties:false on every object.
export const BACKFILL_JSON_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step_number: { type: "integer" },
          body: { type: "string" },
        },
        required: ["step_number", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
} as const;

export type ParsedBackfill =
  | { ok: true; bodies: Map<number, string> }
  | { ok: false; reason: string };

export function parseBackfillResponse(json: unknown, expectedStepNumbers: number[]): ParsedBackfill {
  const steps = (json as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps)) return { ok: false, reason: "The response has no steps array." };
  const bodies = new Map<number, string>();
  for (const item of steps) {
    const stepNumber = (item as { step_number?: unknown } | null)?.step_number;
    const body = (item as { body?: unknown } | null)?.body;
    if (typeof stepNumber !== "number" || !Number.isInteger(stepNumber) || typeof body !== "string") {
      return { ok: false, reason: "A step in the response is malformed." };
    }
    if (bodies.has(stepNumber)) return { ok: false, reason: `Step ${stepNumber} appears twice in the response.` };
    bodies.set(stepNumber, body);
  }
  const expected = new Set(expectedStepNumbers);
  if (bodies.size !== expected.size || [...bodies.keys()].some((n) => !expected.has(n))) {
    return { ok: false, reason: "The response's step numbers do not match the recipe's steps." };
  }
  return { ok: true, bodies };
}

// ---------------------------------------------------------------------------
// SQL generation (the script writes these files; a human runs them with psql)
// ---------------------------------------------------------------------------

export type ApplyRow = { step_id: string; old_body: string; new_body: string };

// With standard_conforming_strings on (set at the top of every generated
// file), a single-quoted literal needs only its single quotes doubled.
function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function payloadLiteral(rows: ApplyRow[]): string {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.step_id)) throw new Error(`Duplicate step_id ${row.step_id}`);
    ids.add(row.step_id);
    if (row.old_body === row.new_body) throw new Error(`Step ${row.step_id} has no change`);
  }
  if (rows.length === 0) throw new Error("Nothing to apply");
  return `${sqlLiteral(JSON.stringify(rows))}::jsonb`;
}

export function buildApplySql(rows: ApplyRow[], finish: "COMMIT" | "ROLLBACK", label: string): string {
  return [
    `-- Meal Queue milestone 18 step-amounts backfill: ${label}.`,
    `-- Steps in this file: ${rows.length}. Changes public.recipe_steps.body only. Ends with ${finish}.`,
    "\\set ON_ERROR_STOP on",
    "SET standard_conforming_strings = on;",
    "BEGIN;",
    "",
    "CREATE TEMP TABLE m18_backfill (step_id uuid PRIMARY KEY, old_body text NOT NULL, new_body text NOT NULL) ON COMMIT DROP;",
    "",
    "INSERT INTO m18_backfill (step_id, old_body, new_body)",
    "SELECT step_id, old_body, new_body",
    `FROM jsonb_to_recordset(${payloadLiteral(rows)}) AS x(step_id uuid, old_body text, new_body text);`,
    "",
    "-- Every reviewed step must still exist with exactly the reviewed text.",
    "DO $$",
    "DECLARE v_expected int; v_matching int;",
    "BEGIN",
    "  SELECT count(*) INTO v_expected FROM m18_backfill;",
    "  SELECT count(*) INTO v_matching FROM public.recipe_steps s JOIN m18_backfill b ON b.step_id = s.id AND s.body = b.old_body;",
    "  IF v_matching <> v_expected THEN",
    "    RAISE EXCEPTION 'M18 preflight: % of % steps still match their reviewed text', v_matching, v_expected;",
    "  END IF;",
    "END $$;",
    "",
    "UPDATE public.recipe_steps s SET body = b.new_body FROM m18_backfill b WHERE s.id = b.step_id AND s.body = b.old_body;",
    "",
    "DO $$",
    "DECLARE v_expected int; v_done int;",
    "BEGIN",
    "  SELECT count(*) INTO v_expected FROM m18_backfill;",
    "  SELECT count(*) INTO v_done FROM public.recipe_steps s JOIN m18_backfill b ON b.step_id = s.id AND s.body = b.new_body;",
    "  IF v_done <> v_expected THEN",
    "    RAISE EXCEPTION 'M18 verify: % of % steps carry the new text', v_done, v_expected;",
    "  END IF;",
    "  RAISE NOTICE 'M18 backfill: % steps updated', v_done;",
    "END $$;",
    "",
    `${finish};`,
    "",
  ].join("\n");
}

export function buildCheckSql(rows: ApplyRow[]): string {
  return [
    "-- Meal Queue milestone 18 check (read-only). Run before and after the apply; compare the output.",
    "\\set ON_ERROR_STOP on",
    "SET standard_conforming_strings = on;",
    `WITH b AS (SELECT * FROM jsonb_to_recordset(${payloadLiteral(rows)}) AS x(step_id uuid, old_body text, new_body text))`,
    "SELECT",
    "  (SELECT count(*) FROM b) AS payload_steps,",
    "  (SELECT count(*) FROM public.recipe_steps s JOIN b ON b.step_id = s.id AND s.body = b.old_body) AS still_old,",
    "  (SELECT count(*) FROM public.recipe_steps s JOIN b ON b.step_id = s.id AND s.body = b.new_body) AS now_new,",
    "  (SELECT count(*) FROM public.recipes) AS recipes,",
    "  (SELECT count(*) FROM public.recipe_steps) AS steps,",
    "  (SELECT count(*) FROM public.ingredients) AS ingredients,",
    "  (SELECT md5(string_agg(s.id::text || ':' || s.step_number || ':' || s.body, '|' ORDER BY s.id)) FROM public.recipe_steps s WHERE s.id NOT IN (SELECT step_id FROM b)) AS untouched_steps_md5,",
    "  (SELECT md5(string_agg(i.id::text || ':' || i.name || ':' || i.amount::text || ':' || i.unit_code || ':' || i.is_pantry_staple::text, '|' ORDER BY i.id)) FROM public.ingredients i) AS ingredients_md5,",
    "  (SELECT md5(string_agg(p.id::text || ':' || p.version || ':' || coalesce(p.groceries_version::text, 'null'), '|' ORDER BY p.id)) FROM public.meal_plans p) AS plan_versions_md5,",
    "  (SELECT md5(string_agg(r.id::text || ':' || r.updated_at::text, '|' ORDER BY r.id)) FROM public.recipes r) AS recipes_updated_md5;",
    "",
  ].join("\n");
}
