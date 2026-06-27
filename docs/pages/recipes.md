# Recipes

> Per-page doc. STUB-level — fleshed out in milestone 5. Grounded in `app/recipes/page.tsx` and `app/recipes/[id]/page.tsx`.

## Purpose

The recipe library and editor. `/recipes` is a searchable, sortable list of the household's recipes plus an inline create/edit editor (ingredients, steps, tags) and a "Load sample data" seeder. `/recipes/[id]` is a read-only detail view with servings scaling, an ingredient list, a step-by-step focus mode for cooking, tags, and delete.

## Route(s)

| Path | File | Kind |
| --- | --- | --- |
| `/recipes` | `app/recipes/page.tsx` | page |
| `/recipes/[id]` | `app/recipes/[id]/page.tsx` | dynamic |

Both pages compose shared chrome the same way: the default export wraps the screen in `AuthGate`, and the inner screen renders inside `AppShell`. See [routes](../routes.md) for the app-wide navigation model. Cross-links: the list links to `/recipes/<id>` ("View recipe") and `/recipes?edit=<id>` ("Edit"); the detail view links back to `/recipes` ("Back") and to `/recipes?edit=<id>` ("Edit recipe").

## Key components

**`/recipes` (`RecipesScreen`)**
- `AuthGate` (gates on Supabase session) → `AppShell` (nav + frame).
- List controls: search `<input>` (name substring, case-insensitive) and a sort `<select>` with options `newest` / `oldest` / `name-asc` / `name-desc` / `servings-desc` / `servings-asc`.
- Recipe list (`.list` of `.list-item`), each with an "Edit" `text-btn` and a `next/link` "View recipe".
- Inline editor (`showEditor` toggle): name, base servings, ingredient rows, step rows, raw instructions, and a tag editor (chips + starter suggestions).
- "Load sample data" seeder (`SAMPLE_RECIPES`, 6 recipes) and "New recipe" action.
- Reads `?edit=<id>` via `useSearchParams` to auto-open the editor on a matching recipe.
- Defaults sourced from `@/lib/constants` (`DEFAULT_UNITS`, `STARTER_TAGS`); units are overridden by the live `units` table when the read succeeds.

**`/recipes/[id]` (`RecipeDetailScreen`)**
- `AuthGate` → `AppShell`.
- `useParams<{ id }>` for the route id; `useRouter` to redirect to `/recipes` after delete.
- Overview panel: base servings, a "Preview servings" stepper (`adjustServings`, min 0.25, step 0.25) driving `scaleFactor`, and a collapsible Tags `<details>`.
- Ingredients list — scaled amounts via `formatAmount` from `@/lib/grocery`; unit labels resolved from the `units` table (falls back to the raw `unit_code`).
- Steps — full ordered list or a single-step "Focus mode" stepper (`focusSteps` / `focusedStepIndex`).
- Collapsible "Raw Instructions" `<details>` (shown only when `instructions_raw` is present).
- Delete sits behind a "More" `<details>` menu with a `window.confirm`.

## Data

Supabase tables, accessed from the client via the browser supabase-js client under owner-based RLS. See [data model](../data-model.md) and `supabase/schema.sql` for canonical definitions.

**`/recipes` reads**
- `recipes` — `id, name, base_servings, instructions_raw`, ordered `created_at` desc.
- `tags` — `name`, ordered by name.
- `units` — `code, label`, ordered by label.
- On select for editing: `recipes` (single), `ingredients` (`name, amount, unit_code, is_pantry_staple`), `recipe_steps` (`step_number, body`), `recipe_tags` (`tags(name)`).

**`/recipes` writes**
- `recipes` — insert (new) or update (existing).
- On save, recipe details are reset and rewritten: `ingredients`, `recipe_steps`, and `recipe_tags` are `delete`d by `recipe_id`, then re-`insert`ed.
- `tags` — `upsert` on conflict `user_id,name` (`ignoreDuplicates`), then re-selected to link.
- `recipe_tags` — insert links.
- `recipes` — delete (with `window.confirm`).
- Sample seeder: reads `recipes` by name, inserts missing `recipes` / `ingredients` / `recipe_steps`, upserts `tags`, inserts `recipe_tags`.

**`/recipes/[id]` reads**
- `recipes` (single by id), `ingredients` (`id, name, amount, unit_code, is_pantry_staple`), `recipe_steps` (`step_number, body`), `recipe_tags` (`tags(name)`), `units` (`code, label`).

**`/recipes/[id]` writes**
- `recipes` — delete by id (then `router.push('/recipes')`).

## UI states

**`/recipes`**
- Loading: `Loading...` while `loadData` runs.
- Empty list: `No recipes yet.` when there are zero recipes.
- No search matches: `No recipes match your search.` when filtering hides all rows.
- Saving: button shows `Saving...`; seeding: button shows `Loading...`.
- Success: `.success-text` (e.g. `Recipe saved.`, `Recipe deleted.`, `Loaded N sample recipes.`, `Sample data already loaded.`).
- Error: `.error-text` shows the message (raw Supabase strings — see flags).
- Editor open vs closed (`showEditor`), new vs edit mode. Delete confirmed via `window.confirm`.

**`/recipes/[id]`**
- Loading: `Loading recipe...`.
- Error: `.error-text`.
- Not-found: no explicit 404 UI — when `recipe` is `null`, the content blocks render nothing.
- Empty ingredients: `No ingredients.`; empty steps: `No steps.`.
- Servings preview adjuster; Focus mode vs full step list toggle.
- Deleting: button shows `Deleting...`; delete confirmed via `window.confirm`.

## Known flags

See [design flags](../design-flags.md) for the full list. Relevant to these routes:

- **Non-atomic recipe saves.** Save does sequential delete-then-reinsert of `ingredients` / `recipe_steps` / `recipe_tags` with no transaction (see `saveRecipe` in `app/recipes/page.tsx`). A mid-sequence failure can leave a partially written recipe. Tracked for the milestone 2 `save_recipe` Postgres function.
- **Raw Supabase error strings render in the UI; no route-level error/loading boundaries.** Both pages surface `error.message` directly via `.error-text` and have no `error.tsx` / `loading.tsx`.
- **Recipe edits do not invalidate downstream grocery lists.** Editing ingredients here does not bump or regenerate the grocery list of a plan that already used the recipe. (Confirm exact behavior against the grocery-staleness flag during milestone 5.)
- **Oversized route components / duplicated `formatDisplayDate`.** Tracked for milestone 6 component hardening.

## Design notes

All styling flows through the CSS-variable token system in `app/globals.css`; see [design system](../design-system.md). No hardcoded design values are introduced here.

Classes observed in source (token/pattern usage to confirm against the design system during milestone 5): layout `split-layout` / `recipes-layout` / `recipe-view-layout` / `recipe-view-content`; `panel`, `section-head`, `section-actions`, `stack`; buttons `primary-btn` / `secondary-btn` / `danger-btn` / `ghost-btn` / `text-btn`; list `list` / `list-item` (`.active`); editor rows `ingredient-row` / `step-row` / `inline-check` / `inline-form`; tags `chip-wrap` / `chip` (`.active`); detail view `recipe-title-row`, `recipe-overview-panel` / `recipe-overview-meta`, `servings-input-row`, `recipe-ingredient-list` / `recipe-meta` / `recipe-meta-left` / `recipe-amount`, `pantry-badge`, `recipe-step-list` / `recipe-step-item` / `recipe-step-index`, `recipe-focus-controls`, `recipe-details` / `recipe-danger-menu` (`<details>`); status helpers `error-text` / `success-text` / `muted`.

- TBD — fill during milestone 5: confirm each class above maps to a documented token/pattern (flag any hardcoded `#fff` / non-token surfaces in [design flags](../design-flags.md)); document mobile behavior of `recipe-view-layout` and `recipe-overview-panel` at the 900px / 700px breakpoints; document the focus-mode cooking experience and the deferred screen wake-lock.
