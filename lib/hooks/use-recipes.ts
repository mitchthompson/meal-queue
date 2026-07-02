import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_UNITS, STARTER_TAGS } from "@/lib/constants";
import { toErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

// Data layer for the recipes screen (milestone 6 extraction — behavior
// identical to the former in-page logic). Owns recipe/tag/unit loading, the
// editor form and its save/delete/seed flows, list filtering, and editor
// visibility (which the write flows and the ?edit= deep link mutate, so it
// lives here); the page keeps only presentation and the tag-input draft.

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

type SampleRecipe = {
  name: string;
  base_servings: number;
  instructions_raw: string;
  tags: string[];
  ingredients: Array<{ name: string; amount: number; unit_code: string; is_pantry_staple: boolean }>;
  steps: string[];
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

const SAMPLE_RECIPES: SampleRecipe[] = [
  {
    name: "Sheet Pan Lemon Chicken and Potatoes",
    base_servings: 2,
    instructions_raw: "Toss ingredients, roast, and finish with lemon.",
    tags: ["chicken", "sheet-pan", "under-30-min"],
    ingredients: [
      { name: "chicken thighs", amount: 1, unit_code: "lb", is_pantry_staple: false },
      { name: "baby potatoes", amount: 1, unit_code: "lb", is_pantry_staple: false },
      { name: "olive oil", amount: 2, unit_code: "tbsp", is_pantry_staple: true },
      { name: "garlic cloves", amount: 3, unit_code: "clove", is_pantry_staple: false },
      { name: "salt", amount: 1, unit_code: "tsp", is_pantry_staple: true },
      { name: "black pepper", amount: 0.5, unit_code: "tsp", is_pantry_staple: true },
      { name: "lemon", amount: 1, unit_code: "item", is_pantry_staple: false },
    ],
    steps: [
      "Heat oven to 425F.",
      "Toss chicken and potatoes with oil, garlic, salt, and pepper.",
      "Spread on sheet pan and roast 25 to 30 minutes.",
      "Squeeze lemon over top before serving.",
    ],
  },
  {
    name: "Turkey Taco Bowls",
    base_servings: 2,
    instructions_raw: "Brown turkey with seasoning and build bowls.",
    tags: ["beef", "mexican", "under-30-min"],
    ingredients: [
      { name: "ground turkey", amount: 1, unit_code: "lb", is_pantry_staple: false },
      { name: "taco seasoning", amount: 2, unit_code: "tbsp", is_pantry_staple: true },
      { name: "rice", amount: 1, unit_code: "cup", is_pantry_staple: false },
      { name: "black beans", amount: 1, unit_code: "cup", is_pantry_staple: false },
      { name: "corn", amount: 1, unit_code: "cup", is_pantry_staple: false },
      { name: "lime", amount: 1, unit_code: "item", is_pantry_staple: false },
    ],
    steps: [
      "Cook rice according to package.",
      "Brown turkey in a skillet and add taco seasoning.",
      "Warm beans and corn.",
      "Assemble bowls with rice, turkey, beans, corn, and lime.",
    ],
  },
  {
    name: "Garlic Butter Shrimp Pasta",
    base_servings: 2,
    instructions_raw: "Cook pasta, saute shrimp, and combine.",
    tags: ["seafood", "italian", "under-30-min"],
    ingredients: [
      { name: "shrimp", amount: 1, unit_code: "lb", is_pantry_staple: false },
      { name: "spaghetti", amount: 8, unit_code: "oz", is_pantry_staple: false },
      { name: "butter", amount: 2, unit_code: "tbsp", is_pantry_staple: false },
      { name: "garlic cloves", amount: 4, unit_code: "clove", is_pantry_staple: false },
      { name: "red pepper flakes", amount: 0.5, unit_code: "tsp", is_pantry_staple: true },
      { name: "parsley", amount: 0.25, unit_code: "cup", is_pantry_staple: false },
      { name: "salt", amount: 1, unit_code: "tsp", is_pantry_staple: true },
    ],
    steps: [
      "Cook pasta in salted water.",
      "Saute garlic in butter, then add shrimp and cook until pink.",
      "Toss shrimp with drained pasta and red pepper flakes.",
      "Top with parsley and serve.",
    ],
  },
  {
    name: "Chickpea Curry",
    base_servings: 2,
    instructions_raw: "Simmer chickpeas with coconut milk and spices.",
    tags: ["vegetarian", "under-30-min"],
    ingredients: [
      { name: "chickpeas", amount: 2, unit_code: "cup", is_pantry_staple: false },
      { name: "coconut milk", amount: 1, unit_code: "cup", is_pantry_staple: false },
      { name: "onion", amount: 1, unit_code: "item", is_pantry_staple: false },
      { name: "garlic cloves", amount: 3, unit_code: "clove", is_pantry_staple: false },
      { name: "curry powder", amount: 1, unit_code: "tbsp", is_pantry_staple: true },
      { name: "olive oil", amount: 1, unit_code: "tbsp", is_pantry_staple: true },
      { name: "salt", amount: 0.75, unit_code: "tsp", is_pantry_staple: true },
    ],
    steps: [
      "Cook onion and garlic in oil until soft.",
      "Stir in curry powder.",
      "Add chickpeas and coconut milk; simmer 12 minutes.",
      "Season with salt and serve.",
    ],
  },
  {
    name: "Slow Cooker Salsa Chicken",
    base_servings: 2,
    instructions_raw: "Cook chicken with salsa in slow cooker and shred.",
    tags: ["chicken", "slow-cooker"],
    ingredients: [
      { name: "chicken breast", amount: 1, unit_code: "lb", is_pantry_staple: false },
      { name: "salsa", amount: 1, unit_code: "cup", is_pantry_staple: false },
      { name: "cumin", amount: 1, unit_code: "tsp", is_pantry_staple: true },
      { name: "salt", amount: 0.5, unit_code: "tsp", is_pantry_staple: true },
      { name: "tortillas", amount: 6, unit_code: "item", is_pantry_staple: false },
    ],
    steps: [
      "Add chicken, salsa, cumin, and salt to slow cooker.",
      "Cook on low for 6 hours or high for 3 hours.",
      "Shred chicken and mix back into sauce.",
      "Serve in tortillas.",
    ],
  },
  {
    name: "Veggie Fried Rice",
    base_servings: 2,
    instructions_raw: "Stir-fry vegetables and day-old rice.",
    tags: ["vegetarian", "stir-fry", "under-30-min"],
    ingredients: [
      { name: "cooked rice", amount: 3, unit_code: "cup", is_pantry_staple: false },
      { name: "eggs", amount: 2, unit_code: "item", is_pantry_staple: false },
      { name: "frozen peas", amount: 1, unit_code: "cup", is_pantry_staple: false },
      { name: "carrot", amount: 1, unit_code: "item", is_pantry_staple: false },
      { name: "soy sauce", amount: 2, unit_code: "tbsp", is_pantry_staple: true },
      { name: "sesame oil", amount: 1, unit_code: "tbsp", is_pantry_staple: true },
      { name: "garlic cloves", amount: 2, unit_code: "clove", is_pantry_staple: false },
    ],
    steps: [
      "Scramble eggs in a hot pan and set aside.",
      "Saute carrot and garlic, then add peas.",
      "Add rice and stir-fry until hot.",
      "Stir in soy sauce, sesame oil, and eggs.",
    ],
  },
];

export function useRecipes(userId: string, editRecipeId: string | null) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [units, setUnits] = useState<{ code: string; label: string }[]>(DEFAULT_UNITS);
  const [form, setForm] = useState<RecipeFormState>(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(recipesRes.error.message);
      setLoading(false);
      return;
    }
    if (tagsRes.error) {
      setError(tagsRes.error.message);
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
      setError(recipeRes.error?.message || ingredientsRes.error?.message || stepsRes.error?.message || recipeTagsRes.error?.message || "Failed to load recipe.");
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

  async function upsertTags(tagNames: string[]) {
    if (tagNames.length === 0) return [];

    const normalized = Array.from(new Set(tagNames.map((t) => t.trim().toLowerCase()).filter(Boolean)));
    if (normalized.length === 0) return [];

    const { error: insertError } = await supabase.from("tags").upsert(
      normalized.map((name) => ({
        user_id: userId,
        name,
      })),
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );

    if (insertError) throw insertError;

    const { data, error: fetchError } = await supabase.from("tags").select("id, name").in("name", normalized).eq("user_id", userId);
    if (fetchError) throw fetchError;
    return data ?? [];
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const name = form.name.trim();
      if (!name) {
        throw new Error("Recipe name is required.");
      }

      // Single transactional upsert (parent + ingredients + steps + tags) via the
      // save_recipe RPC. Any invalid child row rolls back the whole save, and the
      // function bumps the version of plans referencing this recipe when its
      // ingredient set changes so their grocery lists are detected as stale.
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

      setMessage("Recipe saved.");
      await loadData();
      setShowEditor(true);
      await selectRecipe(recipeId);
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
      setError(deleteError.message);
      return;
    }

    setForm(blankForm());
    setShowEditor(false);
    setMessage("Recipe deleted.");
    loadData();
  }

  async function loadSampleData() {
    setSeeding(true);
    setError(null);
    setMessage(null);

    try {
      const sampleNames = SAMPLE_RECIPES.map((recipe) => recipe.name);
      const { data: existingRecipes, error: existingError } = await supabase
        .from("recipes")
        .select("name")
        .in("name", sampleNames);

      if (existingError) throw existingError;

      const existingNames = new Set((existingRecipes ?? []).map((recipe) => recipe.name));
      const missing = SAMPLE_RECIPES.filter((recipe) => !existingNames.has(recipe.name));

      if (missing.length === 0) {
        setMessage("Sample data already loaded.");
        setSeeding(false);
        return;
      }

      const { data: createdRecipes, error: createRecipesError } = await supabase
        .from("recipes")
        .insert(
          missing.map((recipe) => ({
            user_id: userId,
            name: recipe.name,
            base_servings: recipe.base_servings,
            instructions_raw: recipe.instructions_raw,
          })),
        )
        .select("id, name");

      if (createRecipesError) throw createRecipesError;

      const recipeIdByName = new Map((createdRecipes ?? []).map((recipe) => [recipe.name, recipe.id]));
      const ingredientRows: Array<{
        recipe_id: string;
        name: string;
        amount: number;
        unit_code: string;
        is_pantry_staple: boolean;
      }> = [];
      const stepRows: Array<{ recipe_id: string; step_number: number; body: string }> = [];

      for (const recipe of missing) {
        const recipeId = recipeIdByName.get(recipe.name);
        if (!recipeId) continue;

        ingredientRows.push(
          ...recipe.ingredients.map((ingredient) => ({
            recipe_id: recipeId,
            name: ingredient.name,
            amount: ingredient.amount,
            unit_code: ingredient.unit_code,
            is_pantry_staple: ingredient.is_pantry_staple,
          })),
        );

        stepRows.push(
          ...recipe.steps.map((body, index) => ({
            recipe_id: recipeId,
            step_number: index + 1,
            body,
          })),
        );
      }

      if (ingredientRows.length > 0) {
        const { error: insertIngredientsError } = await supabase.from("ingredients").insert(ingredientRows);
        if (insertIngredientsError) throw insertIngredientsError;
      }
      if (stepRows.length > 0) {
        const { error: insertStepsError } = await supabase.from("recipe_steps").insert(stepRows);
        if (insertStepsError) throw insertStepsError;
      }

      const tagNames = Array.from(new Set(missing.flatMap((recipe) => recipe.tags)));
      const tagRows = await upsertTags(tagNames);
      const tagIdByName = new Map(tagRows.map((tag) => [tag.name, tag.id]));
      const linkRows: Array<{ recipe_id: string; tag_id: string }> = [];

      for (const recipe of missing) {
        const recipeId = recipeIdByName.get(recipe.name);
        if (!recipeId) continue;
        for (const tagName of recipe.tags) {
          const tagId = tagIdByName.get(tagName);
          if (tagId) linkRows.push({ recipe_id: recipeId, tag_id: tagId });
        }
      }

      if (linkRows.length > 0) {
        const { error: insertRecipeTagsError } = await supabase.from("recipe_tags").insert(linkRows);
        if (insertRecipeTagsError) throw insertRecipeTagsError;
      }

      await loadData();
      setMessage(`Loaded ${missing.length} sample recipes.`);
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Failed loading sample data."));
    } finally {
      setSeeding(false);
    }
  }

  return {
    recipes,
    knownTags,
    units,
    form,
    setForm,
    loading,
    saving,
    seeding,
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
    loadSampleData,
  };
}
