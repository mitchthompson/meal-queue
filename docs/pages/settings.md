# Settings page

> Status: STUB — confirmed against source. Items marked "TBD — fill during milestone 5" still need design/behavior detail.

## Purpose

Account and planning-defaults screen. Shows the signed-in email, offers a sign-out
action, and provides a form for the household's planning defaults: default plan
length, the weekday a planning week starts on, and the default grocery order/pickup
weekdays. These defaults seed the meal-plan create flow on the [plans page](plans.md).

## Route(s)

- Path: `/settings`
- File: `app/settings/page.tsx`
- Kind: page (static route)

The default export `SettingsPage` wraps the inner `SettingsScreen` client component
in `<AuthGate>`, passing `session.user.id` and `session.user.email` down.

## Key components

- `AuthGate` (`components/auth-gate.tsx`) — gates on the Supabase session.
- `AppShell` (`components/app-shell.tsx`) — nav + content frame; receives `userEmail`.
- `SettingsScreen` — inner client component holding all form state.
- `WEEKDAYS` constant (`lib/constants.ts`) — option list for the three weekday `<select>`s.
- `supabase.auth.signOut()` — wired to the "Sign out" button.

Two `<section className="panel">` blocks: an **Account** panel (email + sign out) and a
**settings form** panel.

## Data

References: [data model](../data-model.md), `supabase/schema.sql`.

Single table: **`public.user_settings`** (one row per user; PK `user_id`).

- READ on mount: `default_plan_days, week_starts_on, default_order_weekday, default_pickup_weekday`
  filtered `.eq("user_id", userId)` via `.maybeSingle()`.
- WRITE on save: `upsert` of `user_id` plus all four fields.
- Auth: `supabase.auth.signOut()` (no table access).

All access is owner-scoped by RLS (`user_settings_owner`: `auth.uid() = user_id`).

Field notes (confirmed against `supabase/schema.sql`):

- `default_plan_days` — `integer`, CHECK between 1 and 21. Form enforces `min=1 max=21`.
- `week_starts_on` — `integer`, CHECK 0–6 (0=Sunday … 6=Saturday); SQL default 5.
- `default_order_weekday` — `integer`, nullable, CHECK 0–6. Form renders a "No default"
  option that maps to `null`.
- `default_pickup_weekday` — `integer`, nullable, CHECK 0–6. Same "No default" → `null`.

## UI states

- **Loading** — form panel shows `Loading settings...` while the initial read runs.
- **Empty / no row** — when no `user_settings` row exists, the form falls back to the
  in-component `initialForm` defaults (`default_plan_days: 7`, `week_starts_on: 5`,
  `default_order_weekday: 3`, `default_pickup_weekday: 4`). See the flag below — these
  client defaults disagree with the nullable SQL defaults for the order/pickup weekdays.
- **Saving** — submit button shows `Saving...` and is disabled.
- **Error** — `<p className="error-text">` renders the raw Supabase error message
  (`loadError.message` / `upsertError.message`).
- **Success** — `<p className="success-text">` renders `Settings saved.` after upsert.

## Known flags

See [design flags](../design-flags.md).

- **`ensureUserSettings` runs twice per sign-in; default settings disagree across files** —
  the client `initialForm` here uses `3`/`4` for order/pickup weekdays, but the SQL
  defaults are `null`. This page is one of the files that duplicates default settings.
- **Raw Supabase error strings render in the UI; no route-level error/loading boundaries** —
  this page surfaces `error.message` directly and has no `error.tsx` / `loading.tsx`.

## Design notes

References: [design system](../design-system.md).

- Layout uses two `.panel` surfaces; headings use `.section-head` + `<h2>`.
- Account email rendered with the `.muted` helper.
- Buttons: sign-out uses `.secondary-btn`; save uses `.primary-btn`.
- Form uses the `.stack` layout with `<label>` wrappers around `<input type="number">`
  and `<select>` controls (the shared global input styling).
- Status text via `.error-text` / `.success-text` helpers.
- Mobile/responsive specifics: TBD — fill during milestone 5.
- Empty-state polish for first-time users: TBD — fill during milestone 5.
