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

## Recipe import (milestone 8, Phase C)

In-app import lives beside the editor on `/recipes`: an **"Import"**
`.secondary-btn` next to "New recipe" (IM7: A), and the `?import=1` deep link,
both open the flow (`components/recipe-import.tsx`, `ImportFlow`) over the
`useImport` hook (`lib/hooks/use-import.ts`). Import and the editor are mutually
exclusive — opening one closes the other. On ≤700px the import panel takes over
the screen exactly like the editor (`.import-open`, list + page head hidden).

The flow is a three-phase state machine (`phase`: `entry` → `parsing` →
`review`; `closed` when not open):

- **Entry** (IM1: B) — **Paste text / Link** mode pills, one input at a time,
  paste-first. Paste is a `.import-textarea` ("Copy the recipe in NYT Cooking,
  then paste it here."); Link is a `type="url"` input. Full-width teal
  "Import recipe" (`.import-submit`), disabled until the active field is
  non-empty.
- **Parsing** (IM2) — inputs/submit disabled, button relabelled
  "Reading recipe…", indeterminate `.import-progress` bar, a Cancel `.text-btn`
  (aborts the fetch), and an `aria-live` line "Reading the recipe. This can take
  about 15 seconds."
- **Review** (IM4: B / IM5 / IM6) — an optional muted provenance line
  ("Imported from `<host>`", URL imports only), a **Parsed / Original** toggle
  (Original shows the verbatim imported text in a scrollable `.import-original`),
  the editable form in the **exact editor idiom** (name, base servings,
  ingredient rows, step rows, tag chips + your-tag suggestions), the muted note
  "The original text is saved with the recipe.", and a full-width teal
  "Save recipe". A `window.confirm("Discard this import?")` guards Close /
  Start over once the review form has been edited.

**How it saves.** The parsing call is `POST /api/import-recipe` (the Phase B
server route — parses via Claude Haiku, never writes the DB). The parsed draft
is mapped to the editor's `RecipeFormState` by the pure, unit-tested
`draftToFormState` (`lib/hooks/draft-to-form.ts`), then **saved through the same
`save_recipe` RPC path as the editor** via the shared `saveRecipeForm`
(`lib/hooks/use-recipes.ts`, extracted in C1 — the editor's behavior is
unchanged). On success the flow routes to `/recipes/<id>`.

**Error copy** (verbatim from the route, shown via `StatusMessage`; the
paywall case is the one amber redirect):

| Code | Treatment | Message |
| --- | --- | --- |
| `paywall_or_blocked` | **Amber** `.import-callout`, flips to paste, keeps URL, focuses textarea | That site blocked the request (likely a paywall). Copy the recipe text from the page and paste it instead. |
| `no_recipe_found` | Red `.error-text` | Couldn't find a recipe in that content. Try pasting just the recipe text. |
| `fetch_failed` | Red `.error-text` | Couldn't fetch that page. Check the URL, or paste the recipe text instead. |
| `text_too_long` / `invalid_request` | Red `.error-text` | (400 validation copy from the route) |
| `unauthorized` | Red `.error-text` | Your session has expired. Sign in again. |
| `llm_failure` / `llm_output_invalid` / `not_configured` | Red `.error-text` | (502/500 copy from the route) |

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
