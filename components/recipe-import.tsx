"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { blankIngredient, blankStep } from "@/lib/hooks/use-recipes";
import type { RecipeFormState } from "@/lib/hooks/use-recipes";
import type { ImportController } from "@/lib/hooks/use-import";
import type { UnitOption } from "@/lib/hooks/draft-to-form";

type ReviewView = "parsed" | "original";

// The in-app recipe-import surface (Phase C, milestone 8). One component that
// switches on flow.phase: an entry screen (paste/link mode pills — IM1: B), a
// parsing wait (IM2), and a review screen (IM4: B parsed/original toggle) whose
// editable form copies the editor idiom from app/recipes/page.tsx verbatim so
// saving reuses the shared saveRecipeForm path. The page owns useImport() so it
// can drive the `import-open` container class and the ?import=1 deep link.
export function ImportFlow({
  flow,
  units,
  knownTags,
}: {
  flow: ImportController;
  units: UnitOption[];
  knownTags: string[];
}) {
  const {
    phase,
    mode,
    setMode,
    sourceText,
    setSourceText,
    sourceUrl,
    setSourceUrl,
    draftForm,
    setDraftForm,
    originalText,
    sourceHost,
    error,
    isPaywallRedirect,
    saving,
    startParse,
    cancelParse,
    saveDraft,
    closeImport,
    backToEntry,
  } = flow;

  const [view, setView] = useState<ReviewView>("parsed");
  const [tagDraft, setTagDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // IM3: on a paywall/blocked redirect the hook flips to paste mode and keeps
  // the URL; move focus to the paste box so the owner can drop the text in.
  // Keyed on the redirect flag only — re-running on later mode toggles (while
  // the flag is still set) would yank focus back mid-interaction.
  useEffect(() => {
    if (isPaywallRedirect && mode === "paste") {
      textareaRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaywallRedirect]);

  const suggestedTags = useMemo(
    () => (draftForm ? knownTags.filter((tag) => !draftForm.tags.includes(tag)) : []),
    [knownTags, draftForm],
  );

  function updateForm(updater: (current: RecipeFormState) => RecipeFormState) {
    setDirty(true);
    setDraftForm((current) => (current ? updater(current) : current));
  }

  function confirmDiscard(): boolean {
    return !dirty || window.confirm("Discard this import?");
  }

  function handleClose() {
    if (!confirmDiscard()) return;
    closeImport();
  }

  function handleStartOver() {
    if (!confirmDiscard()) return;
    setDirty(false);
    setView("parsed");
    backToEntry();
  }

  // ---- entry + parsing (share the same surface; parsing disables it) ----
  if (phase === "entry" || phase === "parsing") {
    const busy = phase === "parsing";
    const canSubmit = mode === "paste" ? sourceText.trim().length > 0 : sourceUrl.trim().length > 0;

    return (
      <section className="panel import-panel">
        <div className="section-head">
          <h2 className="recipes-editor-title">Import recipe</h2>
          <div className="section-actions">
            <button className="text-btn" onClick={handleClose} type="button" disabled={busy}>
              <span className="editor-close-desktop">Close</span>
              <span className="editor-close-mobile">‹ Back to recipes</span>
            </button>
          </div>
        </div>

        <div className="stack import-entry">
          <div className="chip-wrap import-modes" role="group" aria-label="Import source">
            <button
              className={mode === "paste" ? "pill active" : "pill"}
              onClick={() => setMode("paste")}
              type="button"
              disabled={busy}
              aria-pressed={mode === "paste"}
            >
              Paste text
            </button>
            <button
              className={mode === "link" ? "pill active" : "pill"}
              onClick={() => setMode("link")}
              type="button"
              disabled={busy}
              aria-pressed={mode === "link"}
            >
              Link
            </button>
          </div>

          {isPaywallRedirect ? (
            <p className="import-callout" role="status" aria-live="polite">
              {error}
            </p>
          ) : null}

          {mode === "paste" ? (
            <label>
              Recipe text
              <textarea
                ref={textareaRef}
                className="import-textarea"
                rows={8}
                disabled={busy}
                placeholder="Copy the recipe in NYT Cooking, then paste it here."
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
              />
            </label>
          ) : (
            <label>
              Recipe URL
              <input
                type="url"
                disabled={busy}
                placeholder="https://cooking.example.com/best-recipe"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </label>
          )}

          {busy ? (
            <div className="import-progress" aria-hidden="true">
              <span />
            </div>
          ) : null}

          <button className="import-submit" onClick={startParse} type="button" disabled={busy || !canSubmit}>
            {busy ? "Reading recipe…" : "Import recipe"}
          </button>

          {busy ? (
            <button className="text-btn import-cancel" onClick={cancelParse} type="button">
              Cancel
            </button>
          ) : null}

          {busy ? (
            <StatusMessage message="Reading the recipe. This can take about 15 seconds." />
          ) : (
            <StatusMessage error={isPaywallRedirect ? null : error} />
          )}
        </div>
      </section>
    );
  }

  // ---- review (IM4: B toggle, IM5/IM6 save cluster) ----
  if (phase === "review" && draftForm) {
    return (
      <section className="panel import-panel">
        <div className="section-head">
          <h2 className="recipes-editor-title">Review recipe</h2>
          <div className="section-actions">
            <button className="text-btn" onClick={handleStartOver} type="button">
              Start over
            </button>
            <button className="text-btn" onClick={handleClose} type="button">
              <span className="editor-close-desktop">Close</span>
              <span className="editor-close-mobile">‹ Back to recipes</span>
            </button>
          </div>
        </div>

        <div className="stack">
          {sourceHost ? <p className="muted import-provenance">Imported from {sourceHost}</p> : null}

          <div className="chip-wrap import-modes" role="group" aria-label="View">
            <button
              className={view === "parsed" ? "pill active" : "pill"}
              onClick={() => setView("parsed")}
              type="button"
              aria-pressed={view === "parsed"}
            >
              Parsed
            </button>
            <button
              className={view === "original" ? "pill active" : "pill"}
              onClick={() => setView("original")}
              type="button"
              aria-pressed={view === "original"}
            >
              Original
            </button>
          </div>

          {view === "original" ? (
            <div className="import-original">{originalText}</div>
          ) : (
            <div className="stack">
              <label>
                Name
                <input
                  required
                  value={draftForm.name}
                  onChange={(event) => updateForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <label>
                Base servings
                <input
                  min={1}
                  step="0.5"
                  required
                  type="number"
                  value={draftForm.base_servings}
                  onChange={(event) => updateForm((current) => ({ ...current, base_servings: event.target.value }))}
                />
              </label>

              <div className="stack">
                <div className="section-head">
                  <h3 className="recipes-card-label">Ingredients</h3>
                  <button
                    className="secondary-btn"
                    onClick={() =>
                      updateForm((current) => ({ ...current, ingredients: [...current.ingredients, blankIngredient()] }))
                    }
                    type="button"
                  >
                    Add ingredient
                  </button>
                </div>
                {draftForm.ingredients.map((ingredient, index) => (
                  <div className="ingredient-row" key={ingredient.id}>
                    <input
                      placeholder="Ingredient"
                      value={ingredient.name}
                      onChange={(event) =>
                        updateForm((current) => ({
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
                        updateForm((current) => ({
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
                        updateForm((current) => ({
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
                          updateForm((current) => ({
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
                        updateForm((current) => ({
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
                  <h3 className="recipes-card-label">Steps</h3>
                  <button
                    className="secondary-btn"
                    onClick={() => updateForm((current) => ({ ...current, steps: [...current.steps, blankStep()] }))}
                    type="button"
                  >
                    Add step
                  </button>
                </div>
                {draftForm.steps.map((step, index) => (
                  <div className="step-row" key={step.id}>
                    <span>{index + 1}.</span>
                    <textarea
                      rows={2}
                      value={step.body}
                      onChange={(event) =>
                        updateForm((current) => ({
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
                        updateForm((current) => ({
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

              <div className="stack">
                <h3 className="recipes-card-label">Tags</h3>
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
                      if (!next || draftForm.tags.includes(next)) return;
                      updateForm((current) => ({ ...current, tags: [...current.tags, next] }));
                      setTagDraft("");
                    }}
                    type="button"
                  >
                    Add tag
                  </button>
                </div>

                <div className="chip-wrap">
                  {draftForm.tags.map((tag) => (
                    <button
                      className="chip active"
                      key={tag}
                      onClick={() =>
                        updateForm((current) => ({ ...current, tags: current.tags.filter((value) => value !== tag) }))
                      }
                      type="button"
                    >
                      {tag} x
                    </button>
                  ))}
                </div>

                {suggestedTags.length > 0 ? (
                  <>
                    <p className="muted">Your tags</p>
                    <div className="chip-wrap">
                      {suggestedTags.map((tag) => (
                        <button
                          className="chip"
                          key={tag}
                          onClick={() => updateForm((current) => ({ ...current, tags: [...current.tags, tag] }))}
                          type="button"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          <p className="muted">The original text is saved with the recipe.</p>

          <button className="import-submit" onClick={saveDraft} type="button" disabled={saving}>
            {saving ? "Saving…" : "Save recipe"}
          </button>
          <StatusMessage error={error} />
        </div>
      </section>
    );
  }

  return null;
}
