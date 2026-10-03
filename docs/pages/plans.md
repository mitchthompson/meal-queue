# Plans page (`/plans`)

> Per-page doc for the Plan screen (reflow screen 4). Confirmed against `app/plans/page.tsx`, `components/plan-day-items.tsx`, `components/plan-add-meal.tsx`, and `lib/hooks/use-plan.ts` (refreshed 2026-10-03 for milestone 17). Habit logic was read from `lib/weekday-habits.ts` and styling from the `.plan-*` and `.quick-add-*` rules in `app/globals.css`. Design intent: [redesign-brief.md](../redesign-brief.md) + review round 1.

## Purpose

The weekly planning screen, built as thumb-first day rows. One card per day of the selected plan, each holding a flat list of meals (no lunch/dinner division, owner decision 2026-07-02). The (+) button on a day, or `+ add another meal`, opens a full-screen add-meal takeover with three modes: Cook, Leftovers, and Eating out. In Cook mode with an empty search, a `Usually on <Weekday>s` group lists the recipes the household usually cooks on that weekday above the results (milestone 17). An `Add the usuals` card above the day rows puts that weekday's usual meal on every empty day from today on, in one tap. Cook rows carry serving steppers, today is highlighted, and the New plan and Edit plan sheets sit behind the header. `Shop this plan` is the flow's exit and links to Shop. Reads and writes are scoped to the signed-in user by Row-Level Security.

## Route(s)

- `/plans`: page (`app/plans/page.tsx`), `"use client"`.
- Default export `PlansPage` wraps `PlanScreen` in `AuthGate`. `PlanScreen` receives only `userId` (`session.user.id`).
- Query params: `?plan=<id>` and `?new=1` (see Deep links below).
- Linked from the tab bar and from Today: `/plans?plan=<current plan id>` ("Open the plan"), `/plans?plan=<next plan id>` ("Open plan"), `/plans?new=1` ("Plan it" and "Plan the week"), and plain `/plans` (the week peek's `plan →` pills).
- Links out: `/recipes/<recipe id>` from meal rows, `/grocery?plan=<plan id>` from `Shop this plan`.
- See [routes](../routes.md) for the full route map.

### Deep links

- `?plan=<id>`: `PlanScreen` passes the param to `usePlan` as `initialPlanId`. If a loaded plan has that id, it is selected and the filter widens to `all`, so a filtered view cannot hide it (the filter ref is primed so the widening does not bounce the selection to the first visible plan). An unknown id is ignored and the default selection applies.
- `?new=1`: once loading finishes, the page opens the New plan sheet and closes the Edit sheet. It waits for load on purpose, so it wins over the load-time selection change that would otherwise close the sheet.
- Either param is stripped after load with `router.replace("/plans", { scroll: false })`, once (`deepLinkHandled`).
- Without a deep link the page starts on the `current` filter and selects the plan that covers today (earliest start if several), else the newest plan.

## Key components

- `AuthGate` (`components/auth-gate.tsx`): gates on a Supabase session.
- `AppShell` (`components/app-shell.tsx`): nav and content frame. It takes `children` only. `PlanAddMeal` renders inside it, beside the `.page-col` column.
- `PlanScreen` (in `app/plans/page.tsx`): presentation only. Header, filter pills, plan picker, New and Edit sheets, the Add the usuals card, day rows, and the exit link. State and writes come from `usePlan`.
- `usePlan(userId, initialPlanId)` (`lib/hooks/use-plan.ts`): the data layer. Loading, plan create/update/delete, optimistic meal writes, filter and selection, the add-meal state machine (mode, search, note, leftover choice, key handler), and the weekday-habit state (`quickSuggestions`, `plannedUsuals`, `addUsuals`).
- `PlanDayItems` (`components/plan-day-items.tsx`): stateless. One day's meal rows plus the add triggers (it only calls `openQuickAdd`).
- `PlanAddMeal` (`components/plan-add-meal.tsx`): stateless full-screen takeover, rendered once and driven by `activeDay`.
- Both components type their props as `Pick<ReturnType<typeof usePlan>, ...>`.
- `lib/weekday-habits.ts`: pure functions (no Supabase, no React): `habitWindowStart`, `weekdayHabits`, `suggestionsForDay`, `planUsuals`, plus the constants `HABIT_LOOKBACK_DAYS` (112), `HABIT_OCCURRENCES` (8), `HABIT_MIN_COOKS` (3), `SUGGESTION_LIMIT` (3). Tested in `lib/weekday-habits.test.ts`.
- `StatusMessage` (`components/status-message.tsx`): the error and success line.
- `lib/date-utils`: the page uses `createDefaultsFromStart`, `dateRange`, `formatDayAbbrev`, `formatDisplayDate`, `toYmd`. The hook uses `createDefaultsFromStart`, `findNextAvailableStartDate`, `nextDayInRange`, `toYmd`. `PlanDayItems` uses `formatDisplayDate`, and the takeover uses `formatDisplayDate` and `formatDayName`. The habit logic uses `addDays`, `dateRange`, `weekdayOf`.
- `toErrorMessage` (`lib/errors.ts`) and `DEFAULT_USER_SETTINGS` (`lib/constants.ts`).
- `next/link`: `/recipes/[id]` from meal rows (only when the row has a recipe id) and `/grocery?plan=<id>`.

## Data

Tables: see [data model](../data-model.md) and `supabase/schema.sql` for canonical columns, constraints, and RLS. Access is owner-scoped by the `meal_plans_owner` policy and the `meal_plan_items_owner` policy (which checks the parent plan's owner). Only the `user_settings` read filters by user in the client; the other reads rely on RLS.

### Reads

On load (`loadInitialData`, one `Promise.all` of five queries, once per mount):

- `meal_plans`: `.select("id, start_date, end_date, order_date, pickup_date, version").order("start_date", { ascending: false })`. Re-read with the same select and order after every write.
- `recipes`: `.select("id, name, base_servings").order("name", { ascending: true })`. Source for the Cook list, the optimistic row's recipe, and habit lookups.
- `user_settings`: `.select("default_plan_days, week_starts_on, default_order_weekday, default_pickup_weekday").eq("user_id", userId).maybeSingle()`. Seeds the New plan form. With no row it falls back to `DEFAULT_USER_SETTINGS` (7 days, week starts on 5, no order or pickup weekday).
- `meal_plan_items` (recency, orders the Cook list): `.select("recipe_id, created_at").not("recipe_id", "is", null).order("created_at", { ascending: false }).limit(200)`.
- `meal_plan_items` (weekday-habit history, milestone 17): `.select("plan_date, slot_type, recipe_id").gte("plan_date", habitWindowStart(todayYmd)).lt("plan_date", todayYmd).order("plan_date", { ascending: false }).limit(1000)`. `habitWindowStart` is `todayYmd` minus 112 days, so the window is the 16 weeks ending yesterday (for 2026-09-30 it is 2026-06-10 through 2026-09-29). `todayYmd` is frozen when the page mounts. Kept separate from the recency query so that query is unchanged.

For the selected plan (`loadPlanItems`, runs whenever the selected plan changes):

- `meal_plan_items`: `.select("id, plan_date, slot_type, leftover_from_item_id, note, serving_multiplier, created_at, recipe:recipes(id, name, base_servings)").eq("meal_plan_id", planId).order("plan_date", { ascending: true }).order("created_at", { ascending: true })`. `meal_type` is not read.

Notes:

- A failed plans, recipes, or settings read stops loading with the mapped error or `Failed loading plans.`. A failed recency read degrades to name order, and a failed habit read degrades to no suggestions and no usuals; neither fails the page. A failed per-plan read sets `Failed loading the plan's meals.` (or the mapped error).
- The recency and habit rows are read once per page load and are not refetched after writes, so an in-session edit does not change the list order or the suggestions until the next load.
- New plan form defaults: the start is the next occurrence of `week_starts_on` (today counts) that is not already a plan's start (`findNextAvailableStartDate`), the end is the start plus `default_plan_days` minus 1, and order and pickup are the weekday on or before the start (blank when unset). Changing Start date re-derives the other three.

### Writes

- `createPlan`: `meal_plans` INSERT `{ user_id, start_date, end_date, order_date, pickup_date }` (blank order and pickup written as null), then `.select("id").single()`. Then re-reads `meal_plans`, selects the new plan, and resets the form to the next free start date.
- `savePlanMeta`: `meal_plans` UPDATE `{ start_date, end_date, order_date, pickup_date }` (blanks as null) `.eq("id", selectedPlan.id)`, then re-reads `meal_plans`.
- `deleteSelectedPlan`: `meal_plans` DELETE `.eq("id", selectedPlan.id)` after the confirm. Its items go with it (`meal_plan_id` is `on delete cascade`).
- `addMeal`: `meal_plan_items` INSERT one row `{ meal_plan_id, plan_date, meal_type: "dinner", slot_type, recipe_id, leftover_from_item_id, note, serving_multiplier }` with `.select("id").single()`. Every current caller passes `serving_multiplier` 1. `note` is trimmed and stored as null when empty. Eating out stores the typed note, or `Eating out` when the box is empty, and no recipe. A leftover stores the source row's recipe and `leftover_from_item_id`.
- `addUsuals` (milestone 17): `meal_plan_items` INSERT of all rows in one call, `batch.map(...)` to `{ meal_plan_id, plan_date, meal_type: "dinner", slot_type: "cook", recipe_id, serving_multiplier: 1 }`, with `.select("id, plan_date, recipe_id")`. One statement, so all rows land or none do.
- `adjustServing`: `meal_plan_items` UPDATE `{ serving_multiplier }` `.eq("id", item.id)`. Cook rows only, step 0.25, floor 0.25 (`Math.max(0.25, Number((item.serving_multiplier + delta).toFixed(2)))`), no ceiling.
- `removeItem`: `meal_plan_items` DELETE `.eq("id", itemId)`. No confirm.
- After every item write the hook re-reads `meal_plans` (same select and order as above) and keeps the selection.
- No client version writes. The `bump_plan_version` trigger does it (see guards below).
- `meal_type` is vestigial since the flat-day rework (owner decision 2026-07-02): NOT NULL in the schema, every new row writes `'dinner'`, and nothing reads it.

### Optimistic writes (milestone 10, extended in milestone 17)

Item writes patch local state first and roll back on failure (milestone 10 PR 2; spec [responsiveness](../plans/responsiveness.md) section 4). Each write sets `saving`, clears `error` and `message`, and after a successful write re-reads `meal_plans` so the local plan row, including `version`, matches the database. There is no item refetch after a write. Last write wins, which is accepted for a single household. Temp rows carry an `optimistic-` id.

- `addMeal(day, options, moveToNextDay)`:
  - A day outside the plan's saved dates throws `This day is outside the plan's saved dates. Save the plan dates first, then add meals.` (the grid renders from the unsaved Edit form, while the database validates against the saved range). Nothing is added locally.
  - Otherwise it appends a temp row (`optimistic-<timestamp>-<random>`; recipe taken from the recipe list for cook, from the source row for leftover, none for eating out), inserts, and swaps the temp id for the real id in place.
  - Then it re-reads `meal_plans`, sets `Recipe added to plan.`, `Leftover added to plan.`, or `Eating out added to plan.`, and closes the takeover. With Shift+Enter it moves the takeover to the next day instead (`nextDayInRange` against the Edit form's end date, clearing the search box; after the last day it closes).
  - On failure it removes only that temp row (a no-op once the id was swapped, so a saved row survives a later re-read failure) and sets `Failed adding meal.` or the mapped error. The takeover stays open.
  - The takeover closes only after the insert and the re-read finish, so the optimistic row sits behind the overlay until then.
- `removeItem(itemId)`: ignores a temp id. Drops the row locally, deletes, re-reads `meal_plans`, and sets `Meal removed.`. If the write fails, it puts the removed row back at its old position (unless it is already there) and sets `Failed removing meal.`. A re-read failure after a successful delete does not bring the row back.
- `adjustServing(item, delta)`: cook rows only, and it ignores a temp id. Patches `serving_multiplier` locally, updates, re-reads `meal_plans`, and sets `Serving updated.`. If the write fails, it restores that row's prior value and sets `Failed updating serving.`.
- `addUsuals()` (milestone 17): filters the batch against the live clock again (a tab left open past midnight cannot write a day that has passed) and does nothing if nothing is left. Appends one temp row per usual (cook, multiplier 1), runs the single multi-row insert, matches the returned rows to temp rows by `plan_date|recipe_id` (not by return order), and swaps in the real ids. If any temp row is left unmatched it reloads the plan's items. Then it re-reads `meal_plans` and sets `Added 1 usual meal.` or `Added {n} usual meals.`. If the write fails, it removes only its own temp rows and sets `Failed adding the usuals.` or the mapped error. A re-read failure after a successful insert keeps the rows.

### Weekday habits (milestone 17)

Logic lives in `lib/weekday-habits.ts`. Spec: [weekday-suggestions](../plans/weekday-suggestions.md).

The rule in one sentence: a recipe is a weekday's habit when it was cooked on that weekday in at least 3 of that weekday's last 8 planned occurrences.

- Cooked: a `meal_plan_items` row with `slot_type = 'cook'` on a date before today, counted once per recipe per date. Leftover and eating-out rows never count as cooks. The app has no cooked state (design flag C2), so a planned cook row stands in for a cooked meal.
- Occurrence: a date of that weekday inside the window that has at least one `meal_plan_items` row of any slot type. A week with nothing planned never counts. An eating-out or leftovers-only day counts as a miss.
- Window: the 112 days (`HABIT_LOOKBACK_DAYS`, 16 weeks) ending yesterday. Today is excluded, so nothing planned for today or later changes a habit. The window is anchored to the day the page loaded.
- Recipes that are no longer in the recipe list (deleted) are dropped.
- Ranking: most cooks first. On a tie, the recipe cooked longest ago comes first (an alternating pair puts the one not cooked last time on top), then name.
- `Usually on <Weekday>s` group: the top habits for the active day's weekday, minus recipes already on that day (cook or leftover rows; rows still being saved do not count yet, so a tapped suggestion stays put while its insert is in flight), then capped at 3 (`SUGGESTION_LIMIT`; the cap applies after the cut). Shown in Cook mode with an empty search only.
- `Add the usuals`: for each day in the plan's saved range that is today or later and has no meal row of any kind, the weekday's top-ranked habit. One meal per empty day, in date order. The same recipe can land on several days (no cross-day check), and the card previews every meal before the tap. Days before today are never filled. The empty-day check uses the live clock, so a tab left open past midnight never offers or writes a day that has passed.

### Database guards behind the writes

- CHECK `meal_plan_items_slot_recipe_check`: eat_out rows have no recipe, cook and leftover rows require one. CHECK `meal_plan_items_leftover_link_check`: only leftover rows carry `leftover_from_item_id`. The database does not require an eat-out note.
- Trigger `validate_meal_plan_item`: `plan_date` inside the plan's range, recipe owned by the plan owner, leftover source must be a cook row in the same plan. Its messages are P0001, so they show verbatim.
- Trigger `protect_plan_range`: `Save dates` fails with the database message if the new range would strand existing items.
- Trigger `bump_plan_version`: adds 1 to `meal_plans.version` for each cook row inserted or deleted, and for an update that changes a cook row's slot type, recipe, serving multiplier, or plan. Leftover, eating-out, note, and date edits do not bump. `Add the usuals` therefore adds one version per row. Shop reads the version and shows its stale-list banner; nothing on this page regenerates the grocery list.
- `leftover_from_item_id` is `on delete set null`, so removing a cook row leaves its leftovers showing `Leftover from earlier cook`.
- `serving_multiplier` is `numeric(8,3)` and must be greater than 0. The page's floor is 0.25.

Schema and migration changes need approval, see [architecture](../architecture.md).

## UI states

- **Loading**: `loading` is true until the first load finishes. `Loading...` shows under the status line.
- **Saving**: `saving` is true for the whole of any write. The create button reads `Saving...` and is disabled. `Save dates`, `Delete plan`, `Add the usuals`, and the rows in the `Usually on` group are disabled while it is true. Serving steppers, `remove`, the results rows, and the other takeover buttons stay enabled.
- **Error**: `StatusMessage` renders `error` as `.error-text` (`role="alert"`), and an error hides any message. Errors and messages clear at the start of the next write, not on a timer. Text comes from `toErrorMessage`: database `raise exception` messages (P0001) pass through verbatim, a few codes map to friendly text, anything else shows its raw message, and the fallbacks are `Failed loading plans.`, `Failed loading the plan's meals.`, `Failed creating plan.`, `Failed saving plan.`, `Failed adding meal.`, `Failed adding the usuals.`, `Failed removing meal.`, `Failed deleting plan.`, and `Failed updating serving.`
- **Success**: `.success-text` (`role="status"`, polite): `Meal plan created.`, `Plan dates saved.`, `Meal plan deleted.`, `Recipe added to plan.`, `Leftover added to plan.`, `Eating out added to plan.`, `Added 1 usual meal.`, `Added {n} usual meals.`, `Meal removed.`, `Serving updated.`
- **Header**: `Plan`, then the selected plan's saved range as `{Mon D} – {Mon D}`, an `Edit` / `Close` toggle (only with a selected plan), and a `New plan` / `Close` toggle. Opening one sheet closes the other.
- **Filter and picker**: pills `Current`, `Upcoming`, `Past`, `All`. Current covers today, Upcoming starts after today, Past ended before today (relative to the day the page loaded). Changing the filter selects the first plan in that view. The `<select>` picker shows only with two or more plans in view, with options `{Mon D, YYYY} to {Mon D, YYYY}`. Current and Upcoming list oldest first, Past and All list newest first.
- **No plans in view**: `No plans in this view yet — create one to start the week.` (hidden while the New plan sheet is open). Selection is not cleared when a view has no plans, so the previously selected plan's header and days stay on screen under this line.
- **New plan sheet**: `New plan`, fields `Start date`, `End date`, `Order date`, `Pickup date` (start and end required), submit `Create meal plan`. Creating a plan selects it and closes the sheet. If the active filter hides the new plan and another plan is in view, selection falls back to the first plan in view (the new one sits under Upcoming or All).
- **Edit plan sheet**: `Edit plan`, fields `Start`, `End`, `Order`, `Pickup`, buttons `Save dates` and `Delete plan`. The day rows render from these fields, so unsaved date edits show immediately. `Save dates` leaves the sheet open. Sheets close whenever the working plan changes.
- **Delete confirm**: `window.confirm("Delete this meal plan and all its planned items?")`.
- **Add the usuals card**: shown above the day rows (below the sheets) when a plan is selected, its meals have loaded, and at least one day qualifies. A qualifying day is in the plan's saved dates, is today or later, has no meal row of any kind (cook, leftover, or eating out), and has a usual recipe for its weekday. Copy: `1 empty day has a usual meal.` or `{n} empty days have a usual meal.`, a line naming each meal as `{Day}: {Recipe}` joined by `, ` (for example `Thu: <recipe>, Fri: <recipe>`), and the button `Add the usuals`. The temp rows fill those days at once, so the card disappears the moment you tap it, and comes back with the error if the write fails. Success shows `Added 1 usual meal.` or `Added {n} usual meals.`.
- **Day rows**: one `.plan-dayrow` per date from the Edit form's start to its end. Header `{Day}` plus ` · today` on today's row, and `{Mon D}`. Meal rows are in load order with new rows appended. An eating-out row shows its note, or `Eating out`. Cook and leftover rows show the recipe name as a link to `/recipes/<id>` (plain text with no id, `Recipe` with no name). Leftover rows add `Leftover from {Mon D}`, or `Leftover from earlier cook` when the source row is gone. Cook rows show `−`, `×{multiplier}`, `+` (aria-labels `Fewer servings`, `More servings`). Every row has `remove`. Steppers and `remove` ignore taps on a row that is still being saved.
- **Empty day vs filled day**: an empty day shows `Nothing planned` and the `+` button (aria-label `Add a meal on {Mon D}`). A day with meals ends with `+ add another meal`.
- **Exit link**: `Shop this plan` to `/grocery?plan=<id>`, shown only when the plan's end date is today or later.
- **Add-meal takeover**: closed renders nothing. Open is a `role="dialog"` with `aria-modal="true"` and `aria-label` `Add a meal on {Mon D}`, a header with `✕ Close` and `Add to {Mon D}`, and the three mode pills `Cook`, `Leftovers`, `Eating out`. Page scroll is locked and Tab focus is trapped while it is open. Opening always starts in Cook mode with an empty search, note, and leftover choice, and focuses the search box. Closing returns focus to the control that opened it.
  - Cook: a `Search recipe...` box, the optional group, the results, and a hint.
    - Group: `Usually on {Weekday}s` (for example `Usually on Thursdays`) over up to 3 recipe rows. It shows only when the search box is empty (whitespace counts as empty) and at least one habit remains after leaving out recipes already on that day. Rows show the name and `Serves {base_servings}`.
    - Results: up to 8 rows with the name and `Serves {base_servings}`. Ordered by when the recipe was most recently added to a plan (from the 200 newest rows), then name. With an empty search, recipes shown in the group are left out so nothing appears twice. With a search, rows are the recipes whose name contains the text (case-insensitive).
    - `No recipes match. Try a different search.` shows when the group and the results are both empty.
    - Hint: `Enter adds the top match · Shift+Enter adds and jumps to the next day`, hidden on touch devices.
  - Leftovers: a `<select>` of cook rows on earlier days of the plan, newest first, labelled `{Mon D, YYYY}: {recipe}`. Rows still being saved are not offered. The first option is preselected. With none, the select shows `No prior cooked meals` and `Add leftovers` is disabled.
  - Eating out: `Optional note (e.g. pizza night)` and `Save eating out`.
  - After a failed add the takeover stays open and the error is set on the page behind the overlay. The takeover does not receive `error`, so the message shows once it is closed.

## Keyboard

All of these apply while the add-meal takeover is open.

- `Enter` in the Cook search box adds the top match, and the takeover closes once the write succeeds. The top match is the first row of the `Usually on` group when the group is showing (empty search), otherwise the first results row. It does nothing when there is no row, or while a write is in flight.
- `Shift+Enter` in the Cook search box adds the same row, then moves the takeover to the next day of the plan (clearing the search box) instead of closing it. After the plan's last day it closes.
- In the Eating out note box, `Enter` saves (typed note, or `Eating out` when empty) and `Shift+Enter` saves and moves to the next day, with the same rules.
- The Leftovers mode has no text box and no Enter shortcut. Use `Add leftovers`.
- `Escape` closes the takeover from anywhere inside it.
- `Tab` and `Shift+Tab` stay inside the takeover. If focus is outside it, Tab moves focus to the first control inside.

## Known flags

See [design flags](../design-flags.md) for full descriptions. Only what is still true for this page is listed.

- **No dark mode.** Plan, including the takeover (light-themed on purpose), has no dark-mode support. Tracked in "Thin empty states, no dark mode", which now covers dark mode only (milestone 14).
- **No automated coverage for the page's Supabase writes or UI interactions.** Vitest covers the pure habit logic (`lib/weekday-habits.test.ts`) and the date, error, and grocery helpers. Nothing covers `usePlan`'s writes, rollbacks, or the page's interactions. The plan-integrity triggers have pgTAP coverage that runs in CI (`supabase/tests/plan_integrity_test.sql`). The harnesses `scripts/review-board/verify-optimistic-pass.mjs` and `verify-weekday-suggestions.mjs` run by hand against a local stack, not in CI. Tracked in "No automated coverage for Supabase write flows or UI interactions".
- **No cooked state** (C2, resolved as a no-op exit, so still true). Habits treat a planned cook row on a past date as cooked, whether or not the meal happened.
- **Vestigial `meal_type` column** (resolved with the flat-day rework, drop not scheduled). Every new row writes `'dinner'`.
- **A failed add is hidden behind the takeover** (found 2026-10-03). `PlanAddMeal` does not receive `error`, so a failed add leaves the takeover open with the message behind the overlay until Close. Tracked in "Add-meal takeover hides its own errors".

## Design notes

Uses the v2 tokens and shared classes from [design system](../design-system.md) and `app/globals.css` (see "Plan components" there). Classes in use today:

- `app/plans/page.tsx`: `page-col`, `plan-head`, `plan-head-meta`, `plan-range`, `plan-filter-row`, `plan-picker-row`, `plan-sheet` (+ `plan-sheet-grid`), `plan-usuals` (+ `plan-usuals-text`, `plan-usuals-line`, `plan-usuals-list`, `plan-usuals-btn`), `plan-dayrow` (+ `today`, added with `clsx`), `plan-dhead`, `plan-generate`. Shared: `ghost-btn`, `pill` (+ `active`, added with `clsx`), `muted`, `panel`, `stack`, `primary-btn`, `secondary-btn`, `danger-btn`, `section-actions`, and `error-text` / `success-text` via `StatusMessage`.
- `components/plan-day-items.tsx`: `plan-slot` (+ `empty`), `plan-slot-main`, `plan-slot-sub`, `plan-slot-actions`, `plan-slot-add`, `plan-slot-more`, `serving-controls`. Shared: `recipe-link`, `text-btn`.
- `components/plan-add-meal.tsx`: `plan-add-meal`, `plan-add-head`, `plan-add-close`, `plan-add-day`, `plan-add-body`, `quick-add-list` (the mode pill row), `quick-add-usuals`, `quick-add-usuals-label`, `quick-add-results`, `quick-add-row`, `quick-add-hint` (on a `plan-slot-sub` line, which the no-match message also uses). Shared: `pill` (+ `active`, chosen with a string ternary here), `muted`, `secondary-btn`.
- `.quick-add-card` is still defined in `app/globals.css` but no component uses it any more (left over from the inline quick-add).

Layout:

- Day rows are single-column at every width. `.page-col` caps the column at 640px, and in the portrait-tablet band (`@media (pointer: coarse) and (max-width: 1024px)`) it fills the shell and centres. `.plan-sheet-grid` is two columns at every width.
- `.plan-add-meal` is `position: fixed; inset: 0` with `z-index: 30` (the `.mobile-tabbar` is 20), `overflow-y: auto`, on `--bg` and `--ink`, so it is light-themed like the rest of the app. `.plan-add-head` is sticky with top safe-area padding. `.plan-add-body` caps at 640px with bottom safe-area padding.
- `.quick-add-hint` is hidden under `@media (hover: none)`.
- `.plan-usuals` borrows the day-card skin (`--surface`, `--line` border, 14px radius, `.plan-slot` padding). `.plan-usuals-btn` is the soft teal Today next-step button (44px minimum, 12px radius). `.quick-add-usuals-label` borrows the `.plan-dhead` label type.
- `.plan-generate` is a full-width link on `--brand`.
- These rules use tokens only (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--brand`, `--color-primary-soft`). Do not hardcode colors or spacing: add or flag tokens per the rules in [design system](../design-system.md).
