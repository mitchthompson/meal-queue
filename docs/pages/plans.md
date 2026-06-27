# Plans page (`/plans`)

> Status: STUB. Confirmed sections are grounded in `app/plans/page.tsx`; unconfirmed items are marked **TBD — fill during milestone 5**.

## Purpose

Meal plan manager. Create plans over a date range, edit a plan's dates plus optional grocery order/pickup dates, and fill a per-day lunch/dinner grid via a quick-add workflow with three slot modes (cook, leftover, eating out) and per-recipe serving multipliers. A single household app — reads/writes are scoped to the signed-in user by Row-Level Security.

## Route(s)

- `/plans` — page (`app/plans/page.tsx`), `"use client"`.
- Default export `PlansPage` wraps the screen in `AuthGate`; the inner `PlansScreen` receives `userId` and `userEmail` from the Supabase session.
- See [routes](../routes.md) for the full route map.

## Key components

- `AuthGate` (`components/auth-gate.tsx`) — gates on a Supabase session.
- `AppShell` (`components/app-shell.tsx`) — persistent nav + content frame; receives `userEmail`.
- `PlansScreen` — the entire page UI and state (one large inner client component). Known oversized component / duplication concern — see Known flags.
- Date helpers from `lib/date-utils`: `createDefaultsFromStart`, `dateRange`, `findNextAvailableStartDate`, `nextDayInRange`, `toYmd`.
- `next/link` to `/recipes/[id]` from cook/leftover slot cards (only when `recipe.id` is present).
- In-page UI: Create-plan form; plan filter pills (`current` / `upcoming` / `past` / `all`); plan list; plan-meta date grid; per-day `plan-grid` with quick-add cards (cook search, leftover `<select>`, eat-out note input) and `serving-controls` steppers.

## Data

Tables — see [data model](../data-model.md) and `supabase/schema.sql` for canonical columns, constraints, and RLS.

Reads:
- `meal_plans` — `id, start_date, end_date, order_date, pickup_date, version`, ordered `start_date` desc (initial load and every refresh).
- `recipes` — `id, name, base_servings`, ordered `name` asc (quick-add cook search source).
- `user_settings` — `default_plan_days, week_starts_on, default_order_weekday, default_pickup_weekday` via `.eq("user_id", userId).maybeSingle()` (seeds create-form defaults).
- `meal_plan_items` — `id, plan_date, meal_type, slot_type, leftover_from_item_id, note, serving_multiplier, recipe:recipes(id, name, base_servings)` for the selected plan, ordered `plan_date` asc.

Writes:
- `meal_plans` — INSERT (create plan), UPDATE (save dates), UPDATE `version` (version bump on every item mutation; see `bumpPlanVersion` — separate `select` then `update`), DELETE (delete plan).
- `meal_plan_items` — INSERT (quick-add cook/leftover/eat_out via `upsertPlanSlot`), UPDATE `serving_multiplier` (`adjustServing`, cook slots only, step ±0.25, floor 0.25), DELETE by `id` (`removeItem`), DELETE `.in("id", ids)` (`clearSlot`).

Slot semantics enforced by the page match the schema CHECK constraints (`meal_plan_items_slot_recipe_check`, `meal_plan_items_leftover_link_check`): cook/leftover carry a `recipe_id`; eat_out carries a `note` and no recipe; leftover carries `leftover_from_item_id`. Leftover options are derived client-side from prior `cook` items on earlier `plan_date`s.

No live data or schema is touched by this doc. Schema/migration changes require approval — see [architecture](../architecture.md).

## UI states

- **Loading** — `loading` true on initial load; plan list shows `Loading...`.
- **Saving** — `saving` true during create/update/delete/version-bump; create button shows `Saving...`; action buttons disabled.
- **Error** — `error` string rendered via `.error-text`. Raw Supabase error messages surface directly to the user (see Known flags).
- **Success** — `message` string rendered via `.success-text` (e.g. `Meal plan created.`, `Plan dates saved.`, `Recipe added to plan.`, `Leftover added to plan.`, `Eating out added to plan.`, `Meal removed.`, `Meal slot cleared.`, `Serving updated.`, `Meal plan deleted.`).
- **No selected plan** — `Select or create a plan.`
- **Empty filtered list** — `No plans in this view yet.`
- **Quick-add open** — active slot shows mode pills; cook = recipe search + match list, leftover = `<select>` of prior cooked meals, eat_out = optional note input.
- **No leftover source** — `No prior cooked meals` option; Add leftovers button disabled.
- **Empty slot vs filled slot** — empty shows `Add lunch` / `Add dinner`; filled shows slot cards plus `Add another lunch recipe` / `Add another dinner recipe`.
- **Delete confirm** — `window.confirm("Delete this meal plan and all its planned items?")`.

Keyboard quick-add (cook input / eat-out input): `Enter` adds the top match; `Shift+Enter` adds and advances to the same meal on the next day in range; `Backspace`/`Delete` on an empty cook query clears the slot; `Escape` cancels the active slot.

## Known flags

See [design flags](../design-flags.md) for full descriptions.

- **Plan version bumps fire for grocery-irrelevant changes** — every mutation here calls `bumpPlanVersion`, which the grocery page treats as stale and silently regenerates. Open.
- **Five sequential round trips per plan mutation (no optimistic UI)** — `upsertPlanSlot` runs insert → version read → version write → item reload → plan reload sequentially; sluggish on iPhone Safari. Open.
- **Raw Supabase error strings render in the UI; no route-level error/loading boundaries** — `error` shows the raw message; no `error.tsx`/`loading.tsx`. Open.
- **Duplicated code: `formatDisplayDate` and lunch/dinner columns** — `formatDisplayDate` is redefined locally here (duplicated across four files); the lunch and dinner column blocks are large near-duplicates within this file. Targeted by milestone 6. Open.
- **Mobile Lunch/Dinner labels rely on nth-child CSS coupling** — mobile labels for this grid are injected via `::before` pseudo-elements tied to child order in `app/globals.css`. Open.

Note: the in-file `settingsDefaults` fallback uses `default_order_weekday: 3` / `default_pickup_weekday: 4`, which disagrees with the SQL defaults (nullable). This is part of the "default settings disagree across files" flag — see [design flags](../design-flags.md).

## Design notes

Uses existing tokens and shared classes from [design system](../design-system.md) / `app/globals.css` — no page-specific tokens confirmed. Classes seen in source: `panel`, `section-head`, `section-actions`, `stack`, `list`, `list-item` (+ `active`), `pill` (+ `active`), `primary-btn`, `secondary-btn`, `danger-btn`, `text-btn`, `recipe-link`, `plan-meta-grid`, `plan-grid`, `plan-grid-head`, `plan-grid-row`, `plan-day-cell`, `plan-day-primary`, `plan-day-secondary`, `plan-slot-cell`, `slot-card`, `quick-add-card`, `quick-add-list`, `serving-controls`, `muted`, `error-text`, `success-text`, plus the page wrapper `plans-page-stack`.

Two breakpoints apply (`max-width: 900px`, `max-width: 700px`): the plan grid uses `display: contents` rows on desktop and transforms into stacked, labeled cards on mobile. Do not hardcode colors/spacing — add or flag tokens per the rules in [design system](../design-system.md).

- Responsive behavior detail / mobile ergonomics review — **TBD — fill during milestone 5**.
- Accessibility (focus order through quick-add, label associations, tab-bar interplay) — **TBD — fill during milestone 5**.
- Loading/feedback redesign (status messaging, optimistic UI) — **TBD — fill during milestone 5**.
