# Settings page

> Status: confirmed against source. Design updated by the v2 sweep Settings pass
> (2026-07-02, round-2 board verdicts ST1: B / ST2 / ST3); behavior unchanged.
> Re-confirmed 2026-07-11 (`DEFAULT_USER_SETTINGS` source of truth, M9 error
> mapping, `userEmail` cleanup reflected below).

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
- `AppShell` (`components/app-shell.tsx`) — nav + content frame. It no longer
  receives `userEmail` (2026-07-03 cleanup); this screen renders the signed-in
  address itself.
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
- **Empty / no row** — when no `user_settings` row exists, the form falls back to
  `DEFAULT_USER_SETTINGS` (`lib/constants.ts`, the single source of truth since
  2026-07-03, mirroring the SQL defaults: `default_plan_days: 7`,
  `week_starts_on: 5`, order/pickup weekdays `null` — users pick their own days).
- **Saving** — submit button shows `Saving...` and is disabled.
- **Error** — `<p className="error-text">` renders the mapped error message via
  `toErrorMessage(loadError, "Failed to load settings.")` /
  `toErrorMessage(upsertError, "Failed to save settings.")` (milestone 9 sweep,
  2026-07-05).
- **Success** — `<p className="success-text">` renders `Settings saved.` after upsert.

## Known flags

See [design flags](../design-flags.md). The two flags formerly listed here are
**resolved**: the `ensureUserSettings` duplicate call was fixed in mini-M5 and
the defaults drift closed by the `DEFAULT_USER_SETTINGS` single source of truth
(2026-07-03); raw error strings and missing boundaries closed with milestone 9
(2026-07-05 — root `error.tsx`/`loading.tsx`/`not-found.tsx` boundaries plus
the `toErrorMessage` sweep, which covers this page's load/save errors).

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
