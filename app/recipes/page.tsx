"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { DEFAULT_UNITS, STARTER_TAGS } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";

type RecipeListItem = {
  id: string;
  name: string;
  base_servings: number;
  instructions_raw: string | null;
};

type IngredientRow = {
  id: string;
  name: string;
  amount: string;
  unit_code: string;
  is_pantry_staple: boolean;
};

type StepRow = {
  id: string;
  body: string;
};

type RecipeFormState = {
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

const blankIngredient = (): IngredientRow => ({
  id: newRowId(),
  name: "",
  amount: "1",
  unit_code: "item",
  is_pantry_staple: false,
});

const blankStep = (): StepRow => ({ id: newRowId(), body: "" });

const blankForm = (): RecipeFormState => ({
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

export default function RecipesPage() {
  return (
    <AuthGate>
      {(session) => <RecipesScreen userId={session.user.id} userEmail={session.user.email} />}
    </AuthGate>
  );
}

function RecipesScreen({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const searchParams = useSearchParams();
  const editRecipeId = searchParams.get("edit");
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [units, setUnits] = useState<{ code: string; label: string }[]>(DEFAULT_UNITS);
  const [form, setForm] = useState<RecipeFormState>(blankForm);
  const [tagDraft, setTagDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const suggestedTags = useMemo(
    () => STARTER_TAGS.filter((tag) => !form.tags.includes(tag) && !knownTags.includes(tag)),
    [form.tags, knownTags],
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!editRecipeId || recipes.length === 0 || form.id === editRecipeId) return;
    if (recipes.some((recipe) => recipe.id === editRecipeId)) {
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

  async function saveRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        user_id: userId,
        name: form.name.trim(),
        base_servings: Number(form.base_servings || 2),
        instructions_raw: form.instructions_raw.trim() || null,
      };

      if (!payload.name) {
        throw new Error("Recipe name is required.");
      }

      let recipeId = form.id;
      if (form.id) {
        const { error: updateError } = await supabase.from("recipes").update(payload).eq("id", form.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from("recipes").insert(payload).select("id").single();
        if (insertError) throw insertError;
        recipeId = data.id;
      }

      if (!recipeId) throw new Error("Unable to determine recipe id.");

      const [deleteIngredientsRes, deleteStepsRes, deleteRecipeTagsRes] = await Promise.all([
        supabase.from("ingredients").delete().eq("recipe_id", recipeId),
        supabase.from("recipe_steps").delete().eq("recipe_id", recipeId),
        supabase.from("recipe_tags").delete().eq("recipe_id", recipeId),
      ]);
      if (deleteIngredientsRes.error || deleteStepsRes.error || deleteRecipeTagsRes.error) {
        throw new Error(
          deleteIngredientsRes.error?.message ||
            deleteStepsRes.error?.message ||
            deleteRecipeTagsRes.error?.message ||
            "Failed resetting recipe details.",
        );
      }

      const ingredientRows = form.ingredients
        .filter((item) => item.name.trim())
        .map((item) => ({
          recipe_id: recipeId,
          name: item.name.trim(),
          amount: Number(item.amount || 0),
          unit_code: item.unit_code,
          is_pantry_staple: item.is_pantry_staple,
        }));

      if (ingredientRows.length > 0) {
        const { error: ingredientError } = await supabase.from("ingredients").insert(ingredientRows);
        if (ingredientError) throw ingredientError;
      }

      const stepRows = form.steps
        .map((step) => step.body.trim())
        .filter(Boolean)
        .map((body, index) => ({
          recipe_id: recipeId,
          step_number: index + 1,
          body,
        }));

      if (stepRows.length > 0) {
        const { error: stepsError } = await supabase.from("recipe_steps").insert(stepRows);
        if (stepsError) throw stepsError;
      }

      const tagRows = await upsertTags(form.tags);
      if (tagRows.length > 0) {
        const { error: linkError } = await supabase.from("recipe_tags").insert(
          tagRows.map((tag) => ({
            recipe_id: recipeId,
            tag_id: tag.id,
          })),
        );
        if (linkError) throw linkError;
      }

      setMessage("Recipe saved.");
      await loadData();
      await selectRecipe(recipeId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to save recipe.");
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
      setError(caughtError instanceof Error ? caughtError.message : "Failed loading sample data.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <AppShell userEmail={userEmail}>
      <section className="hero">
        <h1>Recipes</h1>
        <p>Create and edit recipes with ingredients, structured steps, pantry flags, and tags.</p>
      </section>

      <section className="split-layout">
        <aside className="panel">
          <div className="section-head">
            <h2>Your recipes</h2>
            <div className="section-actions">
              <button className="secondary-btn" disabled={seeding} onClick={loadSampleData} type="button">
                {seeding ? "Loading..." : "Load sample data"}
              </button>
              <button className="secondary-btn" onClick={() => setForm(blankForm())} type="button">
                New recipe
              </button>
            </div>
          </div>
          {loading ? <p>Loading...</p> : null}
          <div className="list">
            {recipes.map((recipe) => (
              <div className={form.id === recipe.id ? "list-item active" : "list-item"} key={recipe.id}>
                <strong>{recipe.name}</strong>
                <span>Serves {recipe.base_servings}</span>
                <div className="section-actions">
                  <button className="text-btn" onClick={() => selectRecipe(recipe.id)} type="button">
                    Select
                  </button>
                  <Link href={`/recipes/${recipe.id}`}>View recipe</Link>
                </div>
              </div>
            ))}
            {!loading && recipes.length === 0 ? <p>No recipes yet.</p> : null}
          </div>
        </aside>

        <section className="panel">
          <form className="stack" onSubmit={saveRecipe}>
            <div className="section-head">
              <h2>{form.id ? "Edit recipe" : "New recipe"}</h2>
              {form.id ? (
                <button className="danger-btn" onClick={deleteRecipe} type="button">
                  Delete
                </button>
              ) : null}
            </div>

            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label>
              Base servings
              <input
                min={1}
                step="0.5"
                required
                type="number"
                value={form.base_servings}
                onChange={(event) => setForm((current) => ({ ...current, base_servings: event.target.value }))}
              />
            </label>

            <div className="stack">
              <div className="section-head">
                <h3>Ingredients</h3>
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setForm((current) => ({ ...current, ingredients: [...current.ingredients, blankIngredient()] }))
                  }
                  type="button"
                >
                  Add ingredient
                </button>
              </div>
              {form.ingredients.map((ingredient, index) => (
                <div className="ingredient-row" key={ingredient.id}>
                  <input
                    placeholder="Ingredient"
                    value={ingredient.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ingredients: current.ingredients.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <input
                    min={0}
                    step="0.1"
                    type="number"
                    value={ingredient.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ingredients: current.ingredients.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, amount: event.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <select
                    value={ingredient.unit_code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ingredients: current.ingredients.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, unit_code: event.target.value } : row,
                        ),
                      }))
                    }
                  >
                    {units.map((unit) => (
                      <option key={unit.code} value={unit.code}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <label className="inline-check">
                    <input
                      checked={ingredient.is_pantry_staple}
                      type="checkbox"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          ingredients: current.ingredients.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, is_pantry_staple: event.target.checked } : row,
                          ),
                        }))
                      }
                    />
                    Pantry
                  </label>
                  <button
                    className="text-btn"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        ingredients:
                          current.ingredients.length === 1
                            ? current.ingredients
                            : current.ingredients.filter((_, rowIndex) => rowIndex !== index),
                      }))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="stack">
              <div className="section-head">
                <h3>Steps</h3>
                <button
                  className="secondary-btn"
                  onClick={() => setForm((current) => ({ ...current, steps: [...current.steps, blankStep()] }))}
                  type="button"
                >
                  Add step
                </button>
              </div>
              {form.steps.map((step, index) => (
                <div className="step-row" key={step.id}>
                  <span>{index + 1}.</span>
                  <textarea
                    rows={2}
                    value={step.body}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        steps: current.steps.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, body: event.target.value } : row,
                        ),
                      }))
                    }
                  />
                  <button
                    className="text-btn"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        steps:
                          current.steps.length === 1
                            ? current.steps
                            : current.steps.filter((_, rowIndex) => rowIndex !== index),
                      }))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <label>
              Raw instructions (optional import capture)
              <textarea
                rows={4}
                value={form.instructions_raw}
                onChange={(event) => setForm((current) => ({ ...current, instructions_raw: event.target.value }))}
              />
            </label>

            <div className="stack">
              <h3>Tags</h3>
              <div className="inline-form">
                <input
                  placeholder="Add a tag"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                />
                <button
                  className="secondary-btn"
                  onClick={() => {
                    const next = tagDraft.trim().toLowerCase();
                    if (!next || form.tags.includes(next)) return;
                    setForm((current) => ({ ...current, tags: [...current.tags, next] }));
                    setTagDraft("");
                  }}
                  type="button"
                >
                  Add tag
                </button>
              </div>

              <div className="chip-wrap">
                {form.tags.map((tag) => (
                  <button
                    className="chip active"
                    key={tag}
                    onClick={() =>
                      setForm((current) => ({ ...current, tags: current.tags.filter((value) => value !== tag) }))
                    }
                    type="button"
                  >
                    {tag} x
                  </button>
                ))}
              </div>

              <p className="muted">Starter suggestions</p>
              <div className="chip-wrap">
                {suggestedTags.map((tag) => (
                  <button
                    className="chip"
                    key={tag}
                    onClick={() => setForm((current) => ({ ...current, tags: [...current.tags, tag] }))}
                    type="button"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <button className="primary-btn" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save recipe"}
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
        </section>
      </section>
    </AppShell>
  );
}
