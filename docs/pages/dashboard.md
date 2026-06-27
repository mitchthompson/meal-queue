# Dashboard page

> Per-page doc. STUB-level — sections marked "TBD — fill during milestone 5" are intentionally deferred. Behavior below is confirmed against source (`app/page.tsx`); nothing here is invented.

## Purpose

The home dashboard: shows the current meal-plan week at a glance (with an optional next week), a "Today" summary of today's lunch/dinner recipes, and a per-plan grocery "need to buy" preview for the current and next plans. Read-only — it performs no writes; all editing happens on the linked `/plans` and `/grocery` pages.

## Route(s)

- Path: `/`
- File: `app/page.tsx`
- Kind: page (App Router, client component — `"use client"`)
- Exported `HomePage` wraps the inner `HomeDashboard` in `<AuthGate>` and passes the signed-in email into `<AppShell>`. See [routes](../routes.md).

## Key components

- `AuthGate` (`components/auth-gate.tsx`) — gates on a Supabase session; renders the sign-in/sign-up flow when unauthenticated.
- `AppShell` (`components/app-shell.tsx`) — persistent nav + content frame; receives `userEmail`.
- `HomeDashboard` — inner client component holding all dashboard state.
- `renderWeek(plan, planItems)` — local render helper producing a week grid (one block per day, lunch/dinner recipe links).
- `next/link` to `/plans`, `/grocery`, and `/recipes/[id]`.
- Date helpers used locally: `formatDisplayDate`, `formatDayName`, `formatLongDate`, plus `dateRange` / `toYmd` from `lib/date-utils`. Note: a `formatDisplayDate` is duplicated across several route files (see Known flags).

### Derived state (confirmed from source)

- `currentPlan` — the plan active today (`start_date <= today <= end_date`); else the soonest upcoming plan; else the most recent plan.
- `nextPlan` — the soonest plan starting after `currentPlan.start_date`.
- `needToBuyPreview` — current-plan grocery rows where `!is_checked && !is_on_hand`, sorted by name, sliced to 6. `nextNeedToBuyPreview` is the same for the next plan.
- `emptyDinnerCount` — count of days in the current plan with no `dinner` item.
- `showNextWeek` — persisted in `localStorage` under key `home_show_next_week`.

## Data

All reads are scoped to the current user by Row-Level Security; there are no writes. See [data model](../data-model.md) and `supabase/schema.sql`.

Reads:
- `meal_plans` — `id, start_date, end_date, order_date, pickup_date`, ordered `start_date` descending.
- `meal_plan_items` — `meal_plan_id, plan_date, meal_type, recipe:recipes(id, name)`, filtered to the latest 4 plans by start date (`.in("meal_plan_id", planIds)` where `planIds = loadedPlans.slice(0, 4)`).
- `grocery_list_items` — `id, meal_plan_id, ingredient_name, amount, unit_code, is_checked, is_on_hand`, filtered to the same latest-4 plan IDs and `is_pantry_staple = false`.

Writes: none.

## UI states

Confirmed from source:
- **Loading** — `Loading dashboard...` while `loadDashboard()` runs.
- **Error** — raw error string rendered in an `.error-text` banner (uses the Supabase error `message` directly; see Known flags).
- **Empty (no plan)** — `No meal plan yet.` in the "This week" panel when there is no `currentPlan`.
- **Empty (no next plan)** — `No next plan yet.` and `No generated list yet for next plan.` in the grocery split.
- **Empty (grocery)** — `No outstanding items.` when the current-plan need-to-buy preview is empty.
- **Populated** — conditional "Today" card (only when today's plan has lunch or dinner recipes), the "This week" grid, the grocery split, and a Show/Hide next week toggle.
- Inline hint: `{n} dinner slot(s) still empty this week.` when `emptyDinnerCount > 0`.

## Known flags

See [design flags](../design-flags.md). Relevant open items:
- **Dashboard can render an empty current week** — meal items and grocery previews load only for the 4 plans with the newest `start_date` (`loadedPlans.slice(0, 4)`). With 4+ future plans, the current/active plan can fall outside that window and the dashboard silently shows nothing. This is the most directly dashboard-affecting flag.
- **Raw Supabase error strings render in the UI; no route-level error/loading boundaries** — the error banner shows the raw `message`; there is no `error.tsx` / `loading.tsx` boundary for this route.
- **Duplicated `formatDisplayDate`** — duplicated across four files including this one; slated for centralization in component hardening.

## Design notes

Uses the CSS-variable token system in `app/globals.css`; no hardcoded values are introduced here. See [design system](../design-system.md). Classes observed in source: `home-grid`, `panel`, `home-today-card`, `home-today-grid`, `home-today-slot`, `home-week-panel`, `home-week-card`, `home-week-grid`, `home-day-block`, `home-day-head`, `home-grocery-panel`, `home-grocery-split`, `home-plan-block`, `home-section-subtitle`, `home-next-wrap`, `section-head`, `section-actions`, `grocery-row`, `stack`, `recipe-link`, `muted`, `error-text`, and the button variants `primary-btn` / `secondary-btn` / `ghost-btn`.

Responsive behavior, token-to-class mapping, and any spacing flags: TBD — fill during milestone 5.
