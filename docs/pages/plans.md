# Plans page (`/plans`)

> Per-page doc for the reflow's Plan screen (screen 4). Confirmed against `app/plans/page.tsx`, `components/plan-day-items.tsx`, and `lib/hooks/use-plan.ts` (updated 2026-07-02 for the flat-day rework, PR #18). Design intent: [redesign-brief.md](../redesign-brief.md) + review round 1.

## Purpose

The weekly planning ritual as thumb-first day rows: one card per plan day holding a flat list of meals (no lunch/dinner division — owner decision 2026-07-02), quick-add (+) as the primary per-day action (cook / leftover / eating-out modes, serving multipliers), today highlighted, New-plan/Edit-plan sheets behind the header, and "Generate grocery list" as the flow's exit (links to Shop, which regenerates from staleness). Reads/writes are scoped to the signed-in user by Row-Level Security.

## Route(s)

- `/plans` — page (`app/plans/page.tsx`), `"use client"`.
- Default export `PlansPage` wraps the screen in `AuthGate`; the inner `PlanScreen` receives `userId` and `userEmail` from the Supabase session.
- See [routes](../routes.md) for the full route map.

## Key components

- `AuthGate` (`components/auth-gate.tsx`) — gates on a Supabase session.
- `AppShell` (`components/app-shell.tsx`) — persistent nav + content frame; receives `userEmail`.
- `PlanScreen` — presentation only; all state and writes live in `usePlan` (`lib/hooks/use-plan.ts`, M6 extraction).
- `PlanDayItems` (`components/plan-day-items.tsx`) — a day's flat meal rows + inline per-day quick-add (44px recipe rows, recents first); renamed from `PlanSlotCell` in the flat-day rework.
- Date helpers from `lib/date-utils`: `createDefaultsFromStart`, `dateRange`, `findNextAvailableStartDate`, `nextDayInRange`, `toYmd`.
- `next/link` to `/recipes/[id]` from cook/leftover slot cards (only when `recipe.id` is present).
- In-page UI: header with range + Edit / New-plan sheet toggles; filter pills (`current` / `upcoming` / `past` / `all`); compact plan `<select>` (2+ plans); `.plan-dayrow` cards with `.plan-slot` rows, quick-add cards (cook search, leftover `<select>`, eat-out note input) and `serving-controls` steppers; `.plan-generate` exit link.

## Data

Tables — see [data model](../data-model.md) and `supabase/schema.sql` for canonical columns, constraints, and RLS.

Reads:
- `meal_plans` — `id, start_date, end_date, order_date, pickup_date, version`, ordered `start_date` desc (initial load and every refresh).
- `recipes` — `id, name, base_servings`, ordered `name` asc (quick-add cook search source).
- `user_settings` — `default_plan_days, week_starts_on, default_order_weekday, default_pickup_weekday` via `.eq("user_id", userId).maybeSingle()` (seeds create-form defaults).
- `meal_plan_items` — `id, plan_date, meal_type, slot_type, leftover_from_item_id, note, serving_multiplier, recipe:recipes(id, name, base_servings)` for the selected plan, ordered `plan_date` asc.

Writes:
- `meal_plans` — INSERT (create plan), UPDATE (save dates), DELETE (delete plan). Version bumps are database triggers scoped to grocery-relevant changes (milestone 3) — no client version writes.
- `meal_plan_items` — INSERT (quick-add cook/leftover/eat_out via `upsertPlanSlot`), UPDATE `serving_multiplier` (`adjustServing`, cook slots only, step ±0.25, floor 0.25), DELETE by `id` (`removeItem`), DELETE `.in("id", ids)` (`clearSlot`).

Slot semantics enforced by the page match the schema CHECK constraints (`meal_plan_items_slot_recipe_check`, `meal_plan_items_leftover_link_check`): cook/leftover carry a `recipe_id`; eat_out carries a `note` and no recipe; leftover carries `leftover_from_item_id`. Leftover options are derived client-side from prior `cook` items on earlier `plan_date`s.

No live data or schema is touched by this doc. Schema/migration changes require approval — see [architecture](../architecture.md).

## UI states

- **Loading** — `loading` true on initial load; plan list shows `Loading...`.
- **Saving** — `saving` true during create/update/delete/version-bump; create button shows `Saving...`; action buttons disabled.
- **Error** — `error` string rendered via `.error-text`. Raw Supabase error messages surface directly to the user (see Known flags).
- **Success** — `message` string rendered via `.success-text` (e.g. `Meal plan created.`, `Plan dates saved.`, `Recipe added to plan.`, `Leftover added to plan.`, `Eating out added to plan.`, `Meal removed.`, `Meal slot cleared.`, `Serving updated.`, `Meal plan deleted.`).
- **No plans in view** — `No plans in this view yet — create one to start the week.`
- **Empty filtered list** — `No plans in this view yet.`
- **Quick-add open** — active slot shows mode pills; cook = recipe search + match list, leftover = `<select>` of prior cooked meals, eat_out = optional note input.
- **No leftover source** — `No prior cooked meals` option; Add leftovers button disabled.
- **Empty day vs filled day** — an empty day shows `Nothing planned` + the (+) button; a day with meals shows its rows plus a small `+ add another meal` line.
- **Delete confirm** — `window.confirm("Delete this meal plan and all its planned items?")`.

Keyboard quick-add (cook input / eat-out input): `Enter` adds the top match; `Shift+Enter` adds and advances to the same meal on the next day in range; `Backspace`/`Delete` on an empty cook query clears the slot; `Escape` cancels the active slot.

## Known flags

See [design flags](../design-flags.md) for full descriptions.

- **No optimistic UI** — mutations still round-trip (insert + item reload + plan reload) before the UI updates; can feel sluggish on iPhone Safari. Open.
- **No route-level error/loading boundaries**; unmapped errors surface raw messages (`lib/errors.ts` maps the common ones). Open.
- **Plan reflow judgment calls** (inline sheets, generate-as-link, filters kept, multi-item slot rendering) — owner sign-off pending. See [design flags](../design-flags.md).

Note: the in-file `settingsDefaults` fallback uses `default_order_weekday: 3` / `default_pickup_weekday: 4`, which disagrees with the SQL defaults (nullable). This is part of the "default settings disagree across files" flag — see [design flags](../design-flags.md).

## Design notes

Uses the v2 tokens and shared classes from [design system](../design-system.md) / `app/globals.css` (see the "Plan components" section there). Key classes: `page-col`, `plan-head`, `plan-filter-row`, `plan-picker-row`, `plan-sheet` (+ `plan-sheet-grid`), `plan-dayrow` (+ `today`), `plan-dhead`, `plan-slot` (+ `empty`), `plan-slot-k`, `plan-slot-main`, `plan-slot-sub`, `plan-slot-actions`, `plan-slot-add`, `plan-slot-more`, `plan-quick-wrap`, `quick-add-card`, `quick-add-list`, `serving-controls`, `plan-generate`.

The day rows are single-column at every width (phone-first; the column caps at 640px via `.page-col`). The old plan-grid and its nth-child mobile label injection are gone. Do not hardcode colors/spacing — add or flag tokens per the rules in [design system](../design-system.md).
