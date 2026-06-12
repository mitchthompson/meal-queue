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
        // 1. Insert the recipe
        const { data: recipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            user_id,
            name,
            base_servings,
            instructions_raw: instructions_raw || null,
          })
          .select("id")
          .single();

        if (recipeError) throw new Error(`Failed to insert recipe: ${recipeError.message}`);
        const recipeId = recipe.id;

        // 2. Insert ingredients
        if (ingredients.length > 0) {
          const ingredientRows = ingredients.map((ing) => ({
            recipe_id: recipeId,
            name: ing.name,
            amount: ing.amount,
            unit_code: ing.unit_code,
            is_pantry_staple: ing.is_pantry_staple,
          }));

          const { error: ingError } = await supabase.from("ingredients").insert(ingredientRows);
          if (ingError) throw new Error(`Failed to insert ingredients: ${ingError.message}`);
        }

        // 3. Insert steps
        const stepRows = steps
          .filter((body) => body.trim())
          .map((body, index) => ({
            recipe_id: recipeId,
            step_number: index + 1,
            body: body.trim(),
          }));

        if (stepRows.length > 0) {
          const { error: stepsError } = await supabase.from("recipe_steps").insert(stepRows);
          if (stepsError) throw new Error(`Failed to insert steps: ${stepsError.message}`);
        }

        // 4. Upsert tags and link them
        if (tags.length > 0) {
          // Insert tags (ignore conflicts on user_id+name)
          const { error: tagInsertError } = await supabase
            .from("tags")
            .upsert(
              tags.map((tagName) => ({
                user_id,
                name: tagName.toLowerCase().trim(),
              })),
              { onConflict: "user_id,name", ignoreDuplicates: true },
            );

          if (tagInsertError) throw new Error(`Failed to upsert tags: ${tagInsertError.message}`);

          // Fetch tag IDs
          const { data: tagRows, error: tagFetchError } = await supabase
            .from("tags")
            .select("id, name")
            .eq("user_id", user_id)
            .in(
              "name",
              tags.map((t) => t.toLowerCase().trim()),
            );

          if (tagFetchError) throw new Error(`Failed to fetch tags: ${tagFetchError.message}`);

          if (tagRows && tagRows.length > 0) {
            const { error: linkError } = await supabase.from("recipe_tags").insert(
              tagRows.map((tag) => ({
                recipe_id: recipeId,
                tag_id: tag.id,
              })),
            );
            if (linkError) throw new Error(`Failed to link tags: ${linkError.message}`);
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Recipe "${name}" saved successfully.\nRecipe ID: ${recipeId}\nIngredients: ${ingredients.length}\nSteps: ${stepRows.length}\nTags: ${tags.length}`,
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
