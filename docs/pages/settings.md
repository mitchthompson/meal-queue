# Settings page

> Status: confirmed against source. Design updated by the v2 sweep Settings pass
> (2026-07-02, round-2 board verdicts ST1: B / ST2 / ST3); behavior unchanged.

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

- Layout: content in the `.page-col` 640px column; `.settings-head` page title
  ("Settings", the cycle screens' h1 pattern); two `.panel` cards headed by
  uppercase `.settings-card-label` h2s ("Account" / "Planning defaults").
- Form: `.settings-form` with one `.settings-row` `<label>` per setting —
  iOS-style grid (label text left, control right at ≤46%), hairline dividers
  between rows, 44px (`2.75rem`) controls. Owner-picked variant B on the
  round-2 review board (2026-07-02).
- Buttons: save is `.settings-save`, a full-width teal bar (the same
  chunky-exit language as Plan's `.plan-generate`); sign-out is
  `.secondary-btn.settings-signout` (44px).
- Account email rendered with the `.muted` helper.
- Status text via the `aria-live` `StatusMessage` component (mini-M5).
- Desktop shares the same row layout inside the 640px column.
- Empty-state polish for first-time users: still TBD (deferred).
