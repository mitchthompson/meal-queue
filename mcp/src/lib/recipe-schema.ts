import { z } from "zod";

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

export const ingredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
  unit_code: z.enum(VALID_UNIT_CODES),
  is_pantry_staple: z.boolean(),
});

export const recipeSchema = z.object({
  name: z.string().min(1),
  base_servings: z.number().positive(),
  instructions_raw: z.string().optional().default(""),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
});

export const saveRecipeInputSchema = recipeSchema.extend({
  user_id: z.string().uuid(),
});

export const exportInputSchema = z.object({
  user_id: z.string().uuid(),
  output_path: z.string().optional(),
});

export const exportEnvelopeSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  source: z.literal("meal-queue-mcp"),
  recipe_count: z.number(),
  recipes: z.array(recipeSchema),
});

export type RecipeData = z.infer<typeof recipeSchema>;
export type IngredientData = z.infer<typeof ingredientSchema>;
export type SaveRecipeInput = z.infer<typeof saveRecipeInputSchema>;
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;
