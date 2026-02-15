"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/lib/supabase/client";

type RecipeRecord = {
  id: string;
  name: string;
  base_servings: number;
  instructions_raw: string | null;
};

type IngredientRecord = {
  id: string;
  name: string;
  amount: number;
  unit_code: string;
  is_pantry_staple: boolean;
};

type StepRecord = {
  step_number: number;
  body: string;
};

function formatAmount(value: number) {
  return Number(value.toFixed(3)).toString();
}

export default function RecipeDetailPage() {
  return (
    <AuthGate>
      {(session) => <RecipeDetailScreen userEmail={session.user.email} />}
    </AuthGate>
  );
}

function RecipeDetailScreen({ userEmail }: { userEmail?: string }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const recipeId = params.id;

  const [recipe, setRecipe] = useState<RecipeRecord | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRecord[]>([]);
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [unitLabelByCode, setUnitLabelByCode] = useState<Record<string, string>>({});
  const [servings, setServings] = useState("2");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pantryCount = useMemo(
    () => ingredients.filter((ingredient) => ingredient.is_pantry_staple).length,
    [ingredients],
  );

  const scaleFactor = useMemo(() => {
    if (!recipe) return 1;
    const target = Number(servings || recipe.base_servings);
    if (!Number.isFinite(target) || target <= 0) return 1;
    return target / Number(recipe.base_servings || 1);
  }, [servings, recipe]);

  useEffect(() => {
    loadRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  async function loadRecipe() {
    setLoading(true);
    setError(null);

    const [recipeRes, ingredientsRes, stepsRes, tagsRes, unitsRes] = await Promise.all([
      supabase.from("recipes").select("id, name, base_servings, instructions_raw").eq("id", recipeId).single(),
      supabase
        .from("ingredients")
        .select("id, name, amount, unit_code, is_pantry_staple")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true }),
      supabase.from("recipe_steps").select("step_number, body").eq("recipe_id", recipeId).order("step_number", { ascending: true }),
      supabase.from("recipe_tags").select("tags(name)").eq("recipe_id", recipeId),
      supabase.from("units").select("code, label"),
    ]);

    if (recipeRes.error || ingredientsRes.error || stepsRes.error || tagsRes.error || unitsRes.error) {
      setError(
        recipeRes.error?.message ||
          ingredientsRes.error?.message ||
          stepsRes.error?.message ||
          tagsRes.error?.message ||
          unitsRes.error?.message ||
          "Failed to load recipe.",
      );
      setLoading(false);
      return;
    }

    const recipeData = recipeRes.data as RecipeRecord;
    setRecipe(recipeData);
    setServings(String(recipeData.base_servings));
    setIngredients((ingredientsRes.data ?? []) as IngredientRecord[]);
    setSteps((stepsRes.data ?? []) as StepRecord[]);
    setTags(
      (tagsRes.data ?? [])
        .map((row) => {
          const tag = row.tags as { name?: string } | null;
          return tag?.name ?? "";
        })
        .filter(Boolean),
    );
    setUnitLabelByCode(
      Object.fromEntries(((unitsRes.data ?? []) as Array<{ code: string; label: string }>).map((unit) => [unit.code, unit.label])),
    );

    setLoading(false);
  }

  async function deleteRecipe() {
    if (!recipe) return;
    if (!window.confirm(`Delete "${recipe.name}"?`)) return;
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }

    router.push("/recipes");
  }

  return (
    <AppShell userEmail={userEmail}>
      <section className="hero">
        {loading ? <h1>Loading recipe...</h1> : null}
        {recipe ? (
          <>
            <p className="eyebrow">Recipe View</p>
            <h1>{recipe.name}</h1>
            <div className="section-actions recipe-hero-actions">
              <Link className="secondary-btn" href={`/recipes?edit=${recipe.id}`}>
                Edit recipe
              </Link>
              <button className="danger-btn" disabled={deleting} onClick={deleteRecipe} type="button">
                {deleting ? "Deleting..." : "Delete recipe"}
              </button>
              <Link className="secondary-btn" href="/recipes">
                Back to recipes
              </Link>
            </div>
          </>
        ) : null}
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {recipe ? (
        <section className="recipe-view-layout">
          <aside className="panel recipe-overview-panel">
            <h2>Overview</h2>
            <div className="recipe-overview-meta">
              <span>Base servings</span>
              <strong>{recipe.base_servings}</strong>
            </div>
            <label>
              Preview servings
              <input
                min={0.25}
                step={0.25}
                type="number"
                value={servings}
                onChange={(event) => setServings(event.target.value)}
              />
            </label>
            {tags.length > 0 ? (
              <details className="recipe-details" open>
                <summary>Tags ({tags.length})</summary>
                <div className="chip-wrap">
                  {tags.map((tag) => (
                    <span className="chip active" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </aside>

          <div className="stack">
            <article className="panel recipe-view-section">
              <div className="section-head">
                <h2>Ingredients</h2>
                {pantryCount > 0 ? <span className="muted">{pantryCount} pantry staple{pantryCount === 1 ? "" : "s"}</span> : null}
              </div>
              {ingredients.length === 0 ? <p className="muted">No ingredients.</p> : null}
              {ingredients.length > 0 ? (
                <ul className="recipe-ingredient-list">
                  {ingredients.map((ingredient) => (
                    <li className="recipe-meta" key={ingredient.id}>
                      <div className="recipe-meta-left">
                        <strong>{ingredient.name}</strong>
                        {ingredient.is_pantry_staple ? <span className="pantry-badge">Pantry staple</span> : null}
                      </div>
                      <span>
                        {formatAmount(Number(ingredient.amount) * scaleFactor)}{" "}
                        {unitLabelByCode[ingredient.unit_code] ?? ingredient.unit_code}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>

            <article className="panel recipe-view-section">
              <h2>Steps</h2>
              {steps.length === 0 ? <p className="muted">No steps.</p> : null}
              <ol className="recipe-step-list">
                {steps.map((step) => (
                  <li className="recipe-step-item" key={step.step_number}>
                    <span className="recipe-step-index">{step.step_number}</span>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
            </article>

            {recipe.instructions_raw ? (
              <details className="panel recipe-details">
                <summary>Raw Instructions</summary>
                <p className="muted">{recipe.instructions_raw}</p>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
