"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { StatusMessage } from "@/components/status-message";
import { blankForm, blankIngredient, blankStep, useRecipes } from "@/lib/hooks/use-recipes";
import type { RecipeSortOption } from "@/lib/hooks/use-recipes";

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
  const {
    recipes,
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
  } = useRecipes(userId, editRecipeId);
  const [tagDraft, setTagDraft] = useState("");

  return (
    <AppShell userEmail={userEmail}>
      <section className={showEditor ? "split-layout recipes-layout editor-open" : "recipes-layout"}>
        <aside className="panel">
          <div className="section-head">
            <h2>Your recipes</h2>
            <div className="section-actions">
              <button className="secondary-btn" disabled={seeding} onClick={loadSampleData} type="button">
                {seeding ? "Loading..." : "Load sample data"}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setForm(blankForm());
                  setShowEditor(true);
                }}
                type="button"
              >
                New recipe
              </button>
              {showEditor ? (
                <button className="text-btn" onClick={() => setShowEditor(false)} type="button">
                  Hide editor
                </button>
              ) : null}
            </div>
          </div>
          {loading ? <p>Loading...</p> : null}
          <div className="recipes-list-controls">
            <input placeholder="Search recipes..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as RecipeSortOption)}>
              <option value="newest">Sort: Newest first</option>
              <option value="oldest">Sort: Oldest first</option>
              <option value="name-asc">Sort: Name A-Z</option>
              <option value="name-desc">Sort: Name Z-A</option>
              <option value="servings-desc">Sort: Servings high-low</option>
              <option value="servings-asc">Sort: Servings low-high</option>
            </select>
            <p className="muted">{visibleRecipes.length} recipes shown</p>
          </div>
          <div className="list">
            {visibleRecipes.map((recipe) => (
              <div className={form.id === recipe.id ? "list-item active" : "list-item"} key={recipe.id}>
                <strong>{recipe.name}</strong>
                <span>Serves {recipe.base_servings}</span>
                <div className="section-actions">
                  <button
                    className="text-btn"
                    onClick={() => {
                      setShowEditor(true);
                      selectRecipe(recipe.id);
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <Link href={`/recipes/${recipe.id}`}>View recipe</Link>
                </div>
              </div>
            ))}
            {!loading && recipes.length === 0 ? <p>No recipes yet.</p> : null}
            {!loading && recipes.length > 0 && visibleRecipes.length === 0 ? <p>No recipes match your search.</p> : null}
          </div>
        </aside>

        {showEditor ? (
          <section className="panel">
          <form className="stack" onSubmit={saveRecipe}>
            <div className="section-head">
              <h2>{form.id ? "Edit recipe" : "New recipe"}</h2>
              <div className="section-actions">
                <button className="text-btn" onClick={() => setShowEditor(false)} type="button">
                  Close
                </button>
                {form.id ? (
                  <button className="danger-btn" onClick={deleteRecipe} type="button">
                    Delete
                  </button>
                ) : null}
              </div>
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
          <StatusMessage error={error} message={message} />
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
