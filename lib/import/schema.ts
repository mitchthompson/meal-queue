// Ported from mcp/src/lib/recipe-schema.ts (2026-07). mcp/ stays a separate consumer.
//
// The draft contract for in-app recipe import. Two schema surfaces live here:
//   - Zod schemas that validate/normalize on the server (strict).
//   - DRAFT_JSON_SCHEMA, a plain-object JSON Schema handed to the LLM for
//     structured output. It is deliberately looser than the zod schemas: the
//     server composes instructions_raw and clamps numbers, so the LLM schema
//     omits instructions_raw and carries no numeric/length constraints (those
//     keywords are unsupported by the structured-output validator anyway).
import { z } from "zod";

// Must equal the DEFAULT_UNITS codes in lib/constants.ts — asserted in
// schema.test.ts so the two can never drift.
export const VALID_UNIT_CODES = [
  "tsp",
  "tbsp",
  "cup",
  "fl_oz",
  "ml",
  "l",
  "oz",
  "lb",
  "g",
  "kg",
  "item",
  "clove",
  "slice",
] as const;

export type UnitCode = (typeof VALID_UNIT_CODES)[number];

export const ingredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
  unit_code: z.enum(VALID_UNIT_CODES),
  is_pantry_staple: z.boolean(),
});

export const recipeDraftSchema = z.object({
  name: z.string().min(1),
  base_servings: z.number().positive(),
  instructions_raw: z.string(),
  tags: z.array(z.string()),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string()),
});

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

// Request body for POST /api/import-recipe. Exactly one of text|url must be
// present (checked in the refine); tags is the user's existing vocabulary.
export const importRequestSchema = z
  .object({
    text: z.string().max(25000).optional(),
    url: z
      .string()
      .max(2000)
      .refine((u) => /^https?:\/\//i.test(u), {
        message: "URL must start with http:// or https://",
      })
      .optional(),
    tags: z.array(z.string().max(40)).max(50).default([]),
  })
  .refine(
    (v) => {
      const hasText = typeof v.text === "string" && v.text.trim().length > 0;
      const hasUrl = typeof v.url === "string" && v.url.trim().length > 0;
      return hasText !== hasUrl; // exactly one
    },
    { message: "Provide exactly one of a recipe URL or pasted recipe text." },
  );

export type ImportRequest = z.infer<typeof importRequestSchema>;

// The object shape the LLM must return (or the no_recipe sentinel). No
// instructions_raw (server-composed), no numeric/length constraints, enum for
// unit_code, additionalProperties:false on every object.
const draftObjectJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    base_servings: { type: "number" },
    tags: { type: "array", items: { type: "string" } },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          unit_code: { type: "string", enum: [...VALID_UNIT_CODES] },
          is_pantry_staple: { type: "boolean" },
        },
        required: ["name", "amount", "unit_code", "is_pantry_staple"],
        additionalProperties: false,
      },
    },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["name", "base_servings", "tags", "ingredients", "steps"],
  additionalProperties: false,
} as const;

export const DRAFT_JSON_SCHEMA = {
  anyOf: [
    draftObjectJsonSchema,
    {
      type: "object",
      properties: { no_recipe: { const: true } },
      required: ["no_recipe"],
      additionalProperties: false,
    },
  ],
} as const;

export type ImportSuccess = {
  draft: RecipeDraft;
  original_text: string;
  meta: {
    source: "url" | "paste";
    extraction: "json-ld" | "text" | null;
    model: string;
    input_tokens: number;
    output_tokens: number;
  };
};

export type ImportFailure = { error: { code: string; message: string } };
