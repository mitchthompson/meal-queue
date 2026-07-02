# Recipes

> Per-page doc. Refreshed 2026-07-02 with the v2 Recipes pass (PR #21) and
> recipe-detail pass (PR #22). Grounded in `app/recipes/page.tsx`,
> `app/recipes/[id]/page.tsx`, and `lib/hooks/use-recipes.ts`.

## Purpose

The recipe library and editor. `/recipes` is a searchable, sortable list of
the household's recipes plus an inline create/edit editor (ingredients,
steps, tags). `/recipes/[id]` is a read-only detail view with servings
scaling, flat ingredient/step lists, tags, delete, and the full-screen
**Cook mode** takeover ("Start cooking", `components/cook-mode.tsx`).

## Route(s)

| Path | File | Kind |
| --- | --- | --- |
| `/recipes` | `app/recipes/page.tsx` | page |
| `/recipes/[id]` | `app/recipes/[id]/page.tsx` | dynamic |

Both pages compose shared chrome the same way: the default export wraps the
screen in `AuthGate`, and the inner screen renders inside `AppShell`. See
[routes](../routes.md) for the app-wide navigation model. Cross-links: the
list links to `/recipes/<id>` ("View recipe") and opens the editor in place
("Edit"); the detail view links back to `/recipes` (the "‹ Recipes"
breadcrumb) and to `/recipes?edit=<id>` ("Edit recipe"). Today's hero
deep-links to `/recipes/<id>?cook=1`, which auto-opens Cook mode once steps
load.

## Key components

**`/recipes` (`RecipesScreen`)**
- `AuthGate` → `AppShell`; data layer in `lib/hooks/use-recipes.ts`
  (M6 slice 4); the page keeps presentation and the tag-input draft only.
- v2 header (PR #21): `.recipes-head` "Recipes" page title +
  `.recipes-card-label` uppercase "Your recipes" card label; the head hides
  with the list in the mobile editor takeover.
- List controls (44px): search `<input>` (name substring, case-insensitive)
  and a sort `<select>` — `newest` / `oldest` / `name-asc` / `name-desc` /
  `servings-desc` / `servings-asc`.
- Recipe list (`.list` of `.list-item` cards): name only (the serves line
  was dropped — owner verdict RC1), with an "Edit" `text-btn` and a teal
  "View recipe" link per card.
- Inline editor (`showEditor`): name, base servings, ingredient rows, step
  rows, raw instructions, tag editor (chips + starter suggestions);
  uppercase INGREDIENTS / STEPS / TAGS section labels; full-width teal
  `.recipes-save`. On ≤700px the open editor replaces the list
  ("‹ Back to recipes", PR #17).
- Reads `?edit=<id>` via `useSearchParams` to auto-open the editor.
- Defaults from `@/lib/constants` (`DEFAULT_UNITS`, `STARTER_TAGS`); units
  overridden by the live `units` table when the read succeeds.
- The "Load sample data" seeder was **removed** (owner verdict RC3,
  2026-07-02) — local review seeding lives in
  `scripts/review-board/seed-review.sql` instead.

**`/recipes/[id]` (`RecipeDetailScreen`)**
- `AuthGate` → `AppShell`; `useParams` for the id, `useRouter` for the
  post-delete redirect, `useSearchParams` for `?cook=1`.
- v2 title row (PR #22, RD5): "‹ Recipes" breadcrumb above the h1; Edit
  recipe + a "More" `<details>` danger menu (delete, `window.confirm`)
  share one row on mobile.
- Overview panel: base servings, "Preview servings" stepper
  (`adjustServings`, min 0.25, step 0.25, 44px controls) driving
  `scaleFactor`, collapsible Tags `<details>`.
- Ingredients — flat hairline rows (RD1: B): name + amber `.pantry-badge`
  left, scaled amount (`formatAmount` from `@/lib/grocery`) right; unit
  labels resolved from `units` (falls back to the raw code).
- Steps — flat hairline rows behind a full-width teal `.recipe-cook-btn`
  "Start cooking" (RD2) that opens the **Cook mode takeover**
  (`components/cook-mode.tsx`: one step at a time, wake lock, muted
  per-step ingredient line). The pre-reflow in-page "focus mode" no longer
  exists.
- Collapsible "Raw Instructions" `<details>` when `instructions_raw` is
  present.

## Data

Supabase tables, accessed from the client via the browser supabase-js
client under owner-based RLS. See [data model](../data-model.md) and
`supabase/schema.sql` for canonical definitions.

**`/recipes` reads**
- `recipes` — `id, name, base_servings, instructions_raw`, ordered
  `created_at` desc.
- `tags` — `name`, ordered by name; `units` — `code, label`, ordered by label.
- On select for editing: `recipes` (single), `ingredients`, `recipe_steps`,
  `recipe_tags` (`tags(name)`).

**`/recipes` writes**
- **`save_recipe` RPC** (milestone 2): one transactional upsert of the
  recipe parent + ingredients + steps + tags; any invalid child row rolls
  back the whole save, and the function bumps versions of plans referencing
  the recipe when its ingredient set changes (diff-based). No client-side
  delete-then-reinsert remains.
- `recipes` — delete (with `window.confirm`).

**`/recipes/[id]` reads**
- `recipes` (single by id), `ingredients`, `recipe_steps`,
  `recipe_tags` (`tags(name)`), `units`.

**`/recipes/[id]` writes**
- `recipes` — delete by id (then `router.push('/recipes')`).

## UI states

**`/recipes`**
- Loading: `Loading...`; empty: `No recipes yet.`; no matches:
  `No recipes match your search.`.
- Saving: button shows `Saving...`; success/error via the `aria-live`
  `StatusMessage` (`Recipe saved.` is set after the post-save editor
  reload — it was previously wiped before paint; fixed in PR #21).
- Editor open vs closed, new vs edit mode.

**`/recipes/[id]`**
- Loading: `Loading recipe...`; error via `StatusMessage`; no explicit 404
  UI (a null recipe renders nothing).
- Empty ingredients: `No ingredients.`; empty steps: `No steps.` (the cook
  button renders only when steps exist).
- Cooking: full-screen Cook mode takeover; `?cook=1` auto-opens it.
- Deleting: button shows `Deleting...`.

## Known flags

See [design flags](../design-flags.md). Still relevant here:

- **Raw Supabase error strings / no route boundaries** — mini-M5 added
  friendly mapping (`lib/errors.ts`) + `StatusMessage`, but unmapped errors
  still surface raw and there are no `error.tsx` / `loading.tsx` boundaries.
- **Cook mode ingredient-chip heuristic** — per-step ingredient matching is
  a name heuristic; owner is judging quality on real recipes over time.
- Resolved and gone from this page: non-atomic saves (M2 RPC), stale
  grocery lists after edits (M2 diff-based bumps), oversized route
  components (M6 hooks), pre-reflow layout language (PRs #19–#22).

## Design notes

All styling flows through the CSS-variable token system in
`app/globals.css`; see [design system](../design-system.md). The v2
language on these screens (PRs #21–#22): shared page-head group
(`.recipes-head h1` / `.recipes-editor-title` / `.recipe-title-row h1`,
grouped with `.settings-head h1`), uppercase `.recipes-card-label`s
(grouped with `.settings-card-label`), full-width teal action bars
(`.recipes-save` / `.recipe-cook-btn`, grouped with `.settings-save`),
44px controls throughout, teal `.recipe-back-link` breadcrumb, flat
hairline rows (`.recipe-meta`, `.recipe-step-item`), and the amber
`.pantry-badge` whose text color is no longer overridden (the old
`.recipe-meta span` rule was retired in favor of `.recipe-amount`).
