import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../lib/supabase.js";
import { VALID_UNIT_CODES } from "../lib/recipe-schema.js";

const inputSchema = {
  user_id: z.string().uuid().describe("Supabase user ID to associate the recipe with"),
  name: z.string().min(1).describe("Recipe name"),
  base_servings: z.number().positive().describe("Number of servings"),
  instructions_raw: z
    .string()
    .optional()
    .default("")
    .describe("Raw instructions text for reference"),
  tags: z
    .array(z.string())
    .default([])
    .describe("Tag names like 'chicken', 'italian', 'under-30-min'"),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().min(0),
        unit_code: z.enum(VALID_UNIT_CODES),
        is_pantry_staple: z.boolean(),
      }),
    )
    .describe("List of ingredients with amounts and units"),
  steps: z.array(z.string()).describe("Ordered cooking steps"),
};

export function registerSaveRecipe(server: McpServer): void {
  server.tool(
    "save-recipe",
    "Saves a structured recipe to the Supabase database. " +
      "Use after parsing recipe content from fetch-recipe-url and getting user confirmation.",
    inputSchema,
    async ({ user_id, name, base_servings, instructions_raw, tags, ingredients, steps }) => {
      try {
        // Single transactional save via the save_recipe Postgres function
        // (migration 20260627222320_atomic_recipe_save.sql): parent + ingredients
        // + steps + tags are written atomically, so a failed child row rolls back
        // the whole save. This client uses the service-role key, so auth.uid() is
        // null inside the function and ownership comes from p_user_id (the
        // documented RLS-bypass path). Blank step bodies and blank-name
        // ingredients are filtered server-side; tags are normalized and deduped.
        const { data: recipeId, error } = await supabase.rpc("save_recipe", {
          p_recipe_id: null,
          p_name: name,
          p_base_servings: base_servings,
          p_instructions_raw: instructions_raw || null,
          p_ingredients: ingredients,
          p_steps: steps,
          p_tags: tags,
          p_user_id: user_id,
        });

        if (error) throw new Error(`Failed to save recipe: ${error.message}`);
        if (!recipeId) throw new Error("save_recipe returned no recipe id.");

        // Mirror the server-side blank filtering so the reported counts match
        // what was actually stored.
        const keptIngredients = ingredients.filter((ing) => ing.name.trim()).length;
        const keptSteps = steps.filter((body) => body.trim()).length;
        const keptTags = new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean)).size;

        return {
          content: [
            {
              type: "text" as const,
              text: `Recipe "${name}" saved successfully.\nRecipe ID: ${recipeId}\nIngredients: ${keptIngredients}\nSteps: ${keptSteps}\nTags: ${keptTags}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error saving recipe: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
