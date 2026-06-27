# Grocery page

> Per-page doc. STUB-level — sections marked "TBD — fill during milestone 5" are not yet confirmed.

## Purpose

Per-plan grocery list. Auto-generates / regenerates an aggregated ingredient list from the plan's cooked meal-plan items, then splits it into three buckets — **Main list**, **On hand**, and **Pantry staples** — with per-item check-off and move actions. Aggregation and amount formatting come from `lib/grocery`; the generated rows are persisted to `grocery_list_items` so checklist state survives until the list is regenerated.

## Route(s)

- Path: `/grocery`
- File: `app/grocery/page.tsx`
- Kind: page
- Composition: `GroceryPage` wraps `GroceryScreen` in `<AuthGate>` (Supabase session gate) and the screen renders inside `<AppShell userEmail=…>`. See [routes](../routes.md).

## Key components

- `AuthGate` (`components/auth-gate.tsx`) — gates on a Supabase session, passes `session.user.email` down.
- `AppShell` (`components/app-shell.tsx`) — persistent nav + content frame.
- `GroceryScreen` — inner client component holding all state.
- `buildGroceryRows`, `formatAmount` from `lib/grocery` — aggregation into grocery rows and display formatting of amounts.
- `toYmd` from `lib/date-utils` — today's date as `YYYY-MM-DD` for the plan window filter.
- Local-only helpers in this file: `formatDisplayDate` (date label) and `toErrorMessage` (extracts a message from an unknown caught error). Note: `formatDisplayDate` is duplicated across several files — see [Known flags](#known-flags).

Layout: a `split-layout` with a meal-plan list `aside.panel` on one side and the grocery `section.panel` on the other. Buckets are `stack` blocks with `section-head` / `section-actions`; each line is a `grocery-row` containing a `grocery-check` label + checkbox.

## Data

Supabase access (all client-side via the browser supabase-js client, scoped by owner RLS). See [data model](../data-model.md) and `supabase/schema.sql`.

Reads:
- `meal_plans` — `id, start_date, end_date, version`, filtered `end_date >= today`. Current plans (span includes today) are ordered before future plans; both sorted by `start_date` ascending.
- `grocery_list_items` — `id, ingredient_name, amount, unit_code, is_pantry_staple, is_on_hand, is_checked, source_key`, filtered by `meal_plan_id`, ordered by `ingredient_name`.
- `meal_plan_items` — count of `slot_type = 'cook'` rows (used to decide whether to auto-generate); and `recipe_id, serving_multiplier` for `slot_type = 'cook'` rows during regeneration.
- `ingredients` — `recipe_id, name, amount, unit_code, is_pantry_staple` for the cooked recipes (fed into `buildGroceryRows`).

Writes (to `grocery_list_items`):
- Regenerate: `DELETE` all rows for the plan, then `INSERT` the freshly built rows.
- `UPDATE is_checked` — single item (`toggleChecked`) and bulk per bucket (`setCheckedForBucket`).
- `UPDATE is_pantry_staple = false` — "Move to main list" (`movePantryToMain`).
- `UPDATE is_on_hand` — "Have this" / "Move back" (`setOnHand`).

Auto-regeneration triggers (on plan select, in `loadGroceryItems`):
- List is empty **and** the plan has at least one cooked meal-plan item → regenerate (silent).
- Any loaded row's `source_key` does not start with `v{plan.version}|` (stale-version detection) → regenerate (silent).

The manual **Regenerate** button calls the same path non-silently and shows a success message.

## UI states

- **Loading** — plan list shows `Loading...` while plans load (`loading`).
- **Regenerating** — Regenerate button shows `Regenerating...` and is disabled (`regenerating`).
- **Empty (no plans)** — `No meal plans yet.` in the plan list.
- **No selection** — `Select a meal plan.` in the main panel.
- **Empty buckets** — `No main-list items.` / `No on-hand items.` / `No pantry staples.` (muted text).
- **Error** — raw error message rendered via `error-text` (`error`).
- **Success** — `Grocery list regenerated from current meal plan.` via `success-text` (`message`), shown only on manual regenerate.
- **Collapsible sections** — On hand and Pantry staples sections toggle via `showOnHand` / `showPantry`, each label showing a live count.
- **Checked rows** — checked Main / Pantry rows get the `grocery-row checked` class.

## Known flags

See [design flags](../design-flags.md).

- **Over-triggered grocery regeneration** — plan version bumps fire for grocery-irrelevant changes; this page detects the stale `source_key` version on load and regenerates silently, wiping the checklist on a minor tweak. Open items: scope the version bumps, and prompt before regenerating instead of doing it silently on load.
- **Raw Supabase error strings in the UI; no route-level error/loading boundaries** — this page renders the raw error message and has no `error.tsx` / `loading.tsx` boundary.
- **`formatDisplayDate` duplicated across files** — also defined here; slated to be centralized.
- **No automated coverage for Supabase write flows** — the regenerate / check-off / move write paths on this page are untested.

## Design notes

Uses the CSS-variable token system in `app/globals.css`; see [design system](../design-system.md). No hardcoded design values are introduced by this page's logic — styling flows through shared classes (`split-layout`, `panel`, `stack`, `section-head`, `section-actions`, `list`, `list-item`, `grocery-row`, `grocery-check`, `secondary-btn`, `text-btn`, `muted`, `error-text`, `success-text`).

Status text uses `.error-text` (`--color-danger`) and `.success-text` (`--color-success`). Checked rows use the `grocery-row.checked` variant.

Detailed visual intent (spacing, responsive behavior of the split layout and bucket sections on the 900px / 700px breakpoints, mobile ergonomics) — TBD — fill during milestone 5.
