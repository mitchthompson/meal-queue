import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_UNITS, STARTER_TAGS } from "@/lib/constants";
import { toErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

// Data layer for the recipes screen (milestone 6 extraction — behavior
// identical to the former in-page logic). Owns recipe/tag/unit loading, the
// editor form and its save/delete flows, list filtering, and editor
// visibility (which the write flows and the ?edit= deep link mutate, so it
// lives here); the page keeps only presentation and the tag-input draft.
// The sample-data seeding flow was retired with the v2 Recipes pass (owner
// verdict RC3, round-3 board 2026-07-02).

export type RecipeListItem = {
  id: string;
  name: string;
  base_servings: number;
  instructions_raw: string | null;
};

export type RecipeSortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "servings-desc" | "servings-asc";

export type IngredientRow = {
  id: string;
  name: string;
  amount: string;
  unit_code: string;
  is_pantry_staple: boolean;
};

export type StepRow = {
  id: string;
  body: string;
};

export type RecipeFormState = {
  id: string | null;
  name: string;
  base_servings: string;
  instructions_raw: string;
  ingredients: IngredientRow[];
  steps: StepRow[];
  tags: string[];
};

const newRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const blankIngredient = (): IngredientRow => ({
  id: newRowId(),
  name: "",
  amount: "1",
  unit_code: "item",
  is_pantry_staple: false,
});

export const blankStep = (): StepRow => ({ id: newRowId(), body: "" });

export const blankForm = (): RecipeFormState => ({
  id: null,
  name: "",
  base_servings: "2",
  instructions_raw: "",
  ingredients: [blankIngredient()],
  steps: [blankStep()],
  tags: [],
});

// Persist a recipe form through the atomic save_recipe RPC (parent +
// ingredients + steps + tags in one transaction). Extracted from the editor's
// saveRecipe (C1, recipe-import) so the import review screen saves through the
// exact same path; the behavior is byte-identical to the former inline block.
// Returns the saved recipe id; throws on validation or RPC failure (the caller
// maps the error via toErrorMessage).
export async function saveRecipeForm(form: RecipeFormState): Promise<string> {
  const name = form.name.trim();
  if (!name) {
    throw new Error("Recipe name is required.");
  }

  const { data: savedId, error: saveError } = await supabase.rpc("save_recipe", {
    p_recipe_id: form.id,
    p_name: name,
    p_base_servings: Number(form.base_servings || 2),
    p_instructions_raw: form.instructions_raw,
    p_ingredients: form.ingredients.map((item) => ({
      name: item.name,
      amount: Number(item.amount || 0),
      unit_code: item.unit_code,
      is_pantry_staple: item.is_pantry_staple,
    })),
    p_steps: form.steps.map((step) => step.body),
    p_tags: form.tags,
  });

  if (saveError) throw saveError;

  const recipeId = (savedId as string | null) ?? form.id;
  if (!recipeId) throw new Error("Unable to determine recipe id.");
  return recipeId;
}

export function useRecipes(userId: string, editRecipeId: string | null) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [units, setUnits] = useState<{ code: string; label: string }[]>(DEFAULT_UNITS);
  const [form, setForm] = useState<RecipeFormState>(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<RecipeSortOption>("newest");
  const [showEditor, setShowEditor] = useState(false);

  const suggestedTags = useMemo(
    () => STARTER_TAGS.filter((tag) => !form.tags.includes(tag) && !knownTags.includes(tag)),
    [form.tags, knownTags],
  );

  const visibleRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = recipes.filter((recipe) => {
      if (!normalizedQuery) return true;
      return recipe.name.toLowerCase().includes(normalizedQuery);
    });

    if (sortBy === "newest") return filtered;
    if (sortBy === "oldest") return [...filtered].reverse();

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "servings-desc":
          return b.base_servings - a.base_servings;
        case "servings-asc":
          return a.base_servings - b.base_servings;
        default:
          return 0;
      }
    });
    return sorted;
  }, [query, recipes, sortBy]);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    if (!editRecipeId || recipes.length === 0 || form.id === editRecipeId) return;
    if (recipes.some((recipe) => recipe.id === editRecipeId)) {
      setShowEditor(true);
      selectRecipe(editRecipeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRecipeId, recipes]);

  async function loadData() {
    setLoading(true);
    setError(null);

    const [recipesRes, tagsRes, unitsRes] = await Promise.all([
      supabase.from("recipes").select("id, name, base_servings, instructions_raw").order("created_at", { ascending: false }),
      supabase.from("tags").select("name").order("name", { ascending: true }),
      supabase.from("units").select("code, label").order("label", { ascending: true }),
    ]);

    if (recipesRes.error) {
      setError(toErrorMessage(recipesRes.error, "Failed to load recipes."));
      setLoading(false);
      return;
    }
    if (tagsRes.error) {
      setError(toErrorMessage(tagsRes.error, "Failed to load tags."));
      setLoading(false);
      return;
    }

    setRecipes((recipesRes.data ?? []) as RecipeListItem[]);
    setKnownTags((tagsRes.data ?? []).map((tag) => tag.name));
    if (!unitsRes.error && unitsRes.data && unitsRes.data.length > 0) {
      setUnits(unitsRes.data);
    }

    setLoading(false);
  }

  async function selectRecipe(recipeId: string) {
    setError(null);
    setMessage(null);

    const [recipeRes, ingredientsRes, stepsRes, recipeTagsRes] = await Promise.all([
      supabase.from("recipes").select("id, name, base_servings, instructions_raw").eq("id", recipeId).single(),
      supabase
        .from("ingredients")
        .select("name, amount, unit_code, is_pantry_staple")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true }),
      supabase.from("recipe_steps").select("step_number, body").eq("recipe_id", recipeId).order("step_number", { ascending: true }),
      supabase.from("recipe_tags").select("tags(name)").eq("recipe_id", recipeId),
    ]);

    if (recipeRes.error || ingredientsRes.error || stepsRes.error || recipeTagsRes.error) {
      setError(toErrorMessage(recipeRes.error ?? ingredientsRes.error ?? stepsRes.error ?? recipeTagsRes.error, "Failed to load recipe."));
      return;
    }

    const mappedTags = (recipeTagsRes.data ?? [])
      .map((row) => {
        const tag = row.tags as { name?: string } | null;
        return tag?.name ?? "";
      })
      .filter(Boolean);

    setForm({
      id: recipeRes.data.id,
      name: recipeRes.data.name,
      base_servings: String(recipeRes.data.base_servings),
      instructions_raw: recipeRes.data.instructions_raw ?? "",
      ingredients: (() => {
        const rows = (ingredientsRes.data ?? []).map((item) => ({
          id: newRowId(),
          name: item.name,
          amount: String(item.amount),
          unit_code: item.unit_code,
          is_pantry_staple: item.is_pantry_staple,
        }));
        return rows.length > 0 ? rows : [blankIngredient()];
      })(),
      steps: (() => {
        const rows = (stepsRes.data ?? []).map((step) => ({
          id: newRowId(),
          body: step.body,
        }));
        return rows.length > 0 ? rows : [blankStep()];
      })(),
      tags: mappedTags,
    });
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      // Single transactional upsert (parent + ingredients + steps + tags) via
      // the save_recipe RPC. Any invalid child row rolls back the whole save,
      // and the function bumps the version of plans referencing this recipe
      // when its ingredient set changes so their grocery lists are detected as
      // stale. Extracted to saveRecipeForm (C1) and shared with import.
      const recipeId = await saveRecipeForm(form);

      await loadData();
      setShowEditor(true);
      await selectRecipe(recipeId);
      // After selectRecipe, which resets the status line — otherwise the
      // confirmation is wiped before it ever paints.
      setMessage("Recipe saved.");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Failed to save recipe."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecipe() {
    if (!form.id) return;
    if (!window.confirm("Delete this recipe?")) return;

    const { error: deleteError } = await supabase.from("recipes").delete().eq("id", form.id);
    if (deleteError) {
      setError(toErrorMessage(deleteError, "Failed to delete recipe."));
      return;
    }

    setForm(blankForm());
    setShowEditor(false);
    setMessage("Recipe deleted.");
    loadData();
  }

  return {
    recipes,
    knownTags,
    units,
    form,
    setForm,
    loading,
    saving,
    error,
    message,
    query,
    setQuery,
    sortBy,
    setSortBy,
    showEditor,
    setShowEditor,
    suggestedTags,
    visibleRecipes,
    selectRecipe,
    saveRecipe,
    deleteRecipe,
  };
}
