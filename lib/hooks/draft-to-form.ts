// Maps a parsed import RecipeDraft (from POST /api/import-recipe) into the
// editor's RecipeFormState so the import review screen reuses the exact editor
// idiom. Kept in a client-free module (type-only imports, no supabase client)
// so vitest can exercise it directly — importing the browser client at load
// throws without NEXT_PUBLIC env, which the test environment does not set.
//
// Rows mirror the shape of blankIngredient()/blankStep() in use-recipes.ts
// (fresh row id + string-typed amount/servings); every draft field overrides
// the defaults, so only the fresh id is inherited. Duplicated here rather than
// importing those factories, which live alongside the client-bound hook.
import type { RecipeDraft } from "@/lib/import/schema";
import type { RecipeFormState } from "@/lib/hooks/use-recipes";

export type UnitOption = { code: string; label: string };

const newRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function draftToFormState(draft: RecipeDraft, units: UnitOption[]): RecipeFormState {
  const unitCodes = new Set(units.map((unit) => unit.code));

  const ingredients = draft.ingredients.map((ingredient) => ({
    id: newRowId(),
    name: ingredient.name,
    amount: String(ingredient.amount),
    // The server already clamps to the 13-code vocabulary, but defend against a
    // unit the live units table does not carry so the <select> stays valid.
    unit_code: unitCodes.has(ingredient.unit_code) ? ingredient.unit_code : "item",
    is_pantry_staple: ingredient.is_pantry_staple,
  }));

  const steps = draft.steps
    .map((body) => ({ id: newRowId(), body }))
    .filter((step) => step.body.trim().length > 0);

  return {
    id: null,
    name: draft.name,
    base_servings: String(draft.base_servings),
    instructions_raw: draft.instructions_raw,
    // The editor always renders at least one ingredient/step row; keep that
    // invariant if the draft somehow arrives empty (schema requires >=1
    // ingredient, but steps may be empty).
    ingredients: ingredients.length > 0 ? ingredients : [{ id: newRowId(), name: "", amount: "1", unit_code: "item", is_pantry_staple: false }],
    steps: steps.length > 0 ? steps : [{ id: newRowId(), body: "" }],
    tags: draft.tags,
  };
}
