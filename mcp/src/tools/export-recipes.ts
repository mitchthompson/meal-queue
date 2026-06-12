import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../lib/supabase.js";
import type { ExportEnvelope } from "../lib/recipe-schema.js";

const inputSchema = {
  user_id: z.string().uuid().describe("Supabase user ID whose recipes to export"),
  output_path: z
    .string()
    .optional()
    .describe("File path to write JSON to (defaults to ./recipe-export.json)"),
};

export function registerExportRecipes(server: McpServer): void {
  server.tool(
    "export-recipes",
    "Exports all recipes for a user as a JSON file. " +
      "The exported file can be imported into a production Meal Queue instance via the /import page.",
    inputSchema,
    async ({ user_id, output_path }) => {
      try {
        // Fetch all recipes for the user
        const { data: recipes, error: recipesError } = await supabase
          .from("recipes")
          .select("id, name, base_servings, instructions_raw")
          .eq("user_id", user_id)
          .order("created_at", { ascending: true });

        if (recipesError) throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
        if (!recipes || recipes.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No recipes found for this user." }],
          };
        }

        const recipeIds = recipes.map((r) => r.id);

        // Fetch all related data in parallel
        const [ingredientsRes, stepsRes, recipeTagsRes] = await Promise.all([
          supabase
            .from("ingredients")
            .select("recipe_id, name, amount, unit_code, is_pantry_staple")
            .in("recipe_id", recipeIds),
          supabase
            .from("recipe_steps")
            .select("recipe_id, step_number, body")
            .in("recipe_id", recipeIds)
            .order("step_number", { ascending: true }),
          supabase
            .from("recipe_tags")
            .select("recipe_id, tags(name)")
            .in("recipe_id", recipeIds),
        ]);

        if (ingredientsRes.error) throw new Error(`Ingredients: ${ingredientsRes.error.message}`);
        if (stepsRes.error) throw new Error(`Steps: ${stepsRes.error.message}`);
        if (recipeTagsRes.error) throw new Error(`Tags: ${recipeTagsRes.error.message}`);

        // Group by recipe_id
        const ingredientsByRecipe = new Map<string, typeof ingredientsRes.data>();
        for (const ing of ingredientsRes.data ?? []) {
          const list = ingredientsByRecipe.get(ing.recipe_id) ?? [];
          list.push(ing);
          ingredientsByRecipe.set(ing.recipe_id, list);
        }

        const stepsByRecipe = new Map<string, typeof stepsRes.data>();
        for (const step of stepsRes.data ?? []) {
          const list = stepsByRecipe.get(step.recipe_id) ?? [];
          list.push(step);
          stepsByRecipe.set(step.recipe_id, list);
        }

        const tagsByRecipe = new Map<string, string[]>();
        for (const rt of recipeTagsRes.data ?? []) {
          const list = tagsByRecipe.get(rt.recipe_id) ?? [];
          const tagData = rt.tags as unknown as { name: string } | null;
          if (tagData?.name) {
            list.push(tagData.name);
          }
          tagsByRecipe.set(rt.recipe_id, list);
        }

        // Assemble export
        const envelope: ExportEnvelope = {
          version: 1,
          exported_at: new Date().toISOString(),
          source: "meal-queue-mcp",
          recipe_count: recipes.length,
          recipes: recipes.map((r) => ({
            name: r.name,
            base_servings: Number(r.base_servings),
            instructions_raw: r.instructions_raw ?? "",
            tags: tagsByRecipe.get(r.id) ?? [],
            ingredients: (ingredientsByRecipe.get(r.id) ?? []).map((ing) => ({
              name: ing.name,
              amount: Number(ing.amount),
              unit_code: ing.unit_code as (typeof import("../lib/recipe-schema.js").VALID_UNIT_CODES)[number],
              is_pantry_staple: ing.is_pantry_staple,
            })),
            steps: (stepsByRecipe.get(r.id) ?? []).map((s) => s.body),
          })),
        };

        const filePath = resolve(output_path ?? "./recipe-export.json");
        await writeFile(filePath, JSON.stringify(envelope, null, 2), "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: `Exported ${recipes.length} recipes to: ${filePath}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error exporting recipes: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
