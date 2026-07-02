# Roadmap

Reliability is the current priority. Existing household data must remain
compatible throughout this work.

## Completed Milestones

### 0. Documentation Foundation

Merged: PR #1, commit `0108c44`

- Establish durable project-memory documents.
- Reconcile outdated project and implementation notes.
- Ignore local Codex metadata and recipe exports.
- Make documentation updates part of every completed change.

Acceptance:

- A new session can identify current state, next work, important decisions, and
  operating procedures by following [README.md](README.md).
- No obsolete document presents completed work as a future plan.

### 1. Reliability Foundation

Merged: `7cfbab2` on 2026-06-11

- [x] Add Vitest and core test scripts.
- [x] Extract testable date, ingredient scaling, and grocery grouping
  functions.
- [x] Add tests for those behaviors.
- [x] Establish `supabase/migrations/` while keeping `supabase/schema.sql` canonical.
- [x] Patch Next.js within major version 15 and resolve npm audit findings.

Acceptance:

- [x] `npm run test`, `npm run typecheck`, and `npm run build` pass.
- [x] Migration naming and application procedures are documented.

## Active Milestones

The 2026-06-11 code audit ([CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md))
confirmed milestones 2-4 as the agreed scope, in this order, implemented with
Postgres functions (RPCs) and triggers applied through the Supabase SQL editor.

The 2026-06-11 front-end UI audit
([UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md)) added milestone 5 (UI feedback
and ergonomics), which runs after the reliability core and before component
hardening.

### 1.5 CI + Test Harness

Done: PR #3 (`240b508`), 2026-07-01. First green run: app checks + 33/33 pgTAP
against a fresh Postgres 17 stack in 1m02s. Branch history:
`codex/atomic-recipe-saves` (scaffold, 2026-06-27) + `codex/ci-grants-fix`
(explicit Data API grants — root cause of the first red run — CLI pinning,
NOTESTS guard).

Added ahead of applying the reliability migrations because there is no staging
environment ("plan B"): prove database changes against a real Postgres before
the live hand-apply.

- GitHub Actions CI: an app-checks job (`npm ci` + typecheck + test + build with
  placeholder `NEXT_PUBLIC_*` env; no lint until ESLint is configured) and a
  db-tests job (ephemeral local Supabase stack via the CLI + pgTAP; no cloud
  credentials).
- pgTAP coverage for `save_recipe` (atomicity rollback, version-bump
  invalidation, RLS/owner-scope on the app and service-role paths).
- A CI/local-only baseline migration (`20260101000000_baseline_schema.sql`, a
  regenerable copy of `schema.sql`) so a fresh CI database builds the schema
  before forward migrations validate. Never applied to prod; supersedes the
  "no synthetic baseline" rule for the local/CI path only (see
  [decisions.md](decisions.md)).
- The Supabase CLI is used for local/CI testing only; prod stays hand-applied.

Acceptance:

- CI runs green on a PR to `main`.
- `save_recipe` is proven by the pgTAP suite before it is applied to prod.

Follow-ups: pin the CLI version, configure ESLint and add a lint step, add a CI
guard that diffs the baseline against `schema.sql`, and confirm `config.toml`
`major_version` against prod.

### 2. Atomic Recipe Saves

Done: PR #2 (`061f541`) merged 2026-07-01; `save_recipe` applied to prod the
same day (backup-first agent runbook, rolled-back live smoke test, API probe)
and the grants migration applied post-merge (verified no-op). Web client and
MCP tool both use the RPC. Version bump is **diff-based** (fires only when the
ingredient set changes). Acceptance proven by 33/33 pgTAP in CI.

- Add a `save_recipe` Postgres function (security invoker, so row-level
  security still applies) that updates the recipe parent and replaces
  ingredients, steps, and tag links in one transaction.
- Replace client-side delete-and-reinsert recipe updates with the RPC.
- Switch the MCP `save-recipe` tool to the same function.
- Invalidate affected meal-plan grocery generations after ingredient changes
  (bump versions of plans that reference the recipe, inside the same
  transaction).
- Preserve the editable form and show useful feedback when a save fails.

Acceptance:

- Any invalid child row rolls back the complete recipe update.
- Ingredient changes make every affected grocery list stale.

### 3. Plan Integrity

Done: PR #4 (`6d086f2`), 2026-07-02. First-try green CI (83/83 pgTAP);
adversarially reviewed (24 findings triaged; two write-skew row-lock fixes,
cross-plan-move guard, +17 assertions); prod applied migration-first with a
rolled-back live smoke test (bump 9→10, out-of-range rejection). Version bumps
are trigger-based and **grocery-scoped**, which also resolved the
"over-triggered regeneration" flag's scoping half and cut two round trips per
plan mutation.

- Move plan version increments to database triggers on `meal_plan_items`
  insert, update, and delete.
- Remove client-side version read/update sequences (drops two round trips per
  plan mutation).
- Add preflight queries and constraints or triggers for: `plan_date` within
  the plan's range, recipe references owned by the plan's owner, and leftover
  links that point at a cook item.

Acceptance:

- Concurrent mutations cannot lose version increments.
- Invalid dates, cross-owner references, and invalid leftovers are rejected.
- Existing data passes preflight checks before constraints are applied.

### 4. Grocery State Preservation

Done: PR #5 (`5450606`), 2026-07-02. First-try green CI (108/108 pgTAP across
three suites). Transactional `regenerate_grocery_list()` upserts by stable
identity (name|unit|pantry, no version prefix), preserving checked / on-hand /
pantry-override state; staleness moved to `meal_plans.groceries_version`
(pairs with milestone 3's scoped bumps); legacy rows normalized
state-intact. Prod applied migration-first; rolled-back live smoke proved
checked state survives regeneration on real data. **The reliability core
(milestones 2–4) is complete.**

- Add a transactional grocery regeneration function.
- Give generated items stable identities within a plan (identity key without
  the version prefix: normalized name, unit, pantry classification).
- Preserve checked, on-hand, and pantry override state for unchanged items.
- Remove obsolete rows only after replacement generation succeeds.

Acceptance:

- Regeneration never exposes a partially rebuilt list.
- Unchanged items retain user state; removed ingredients disappear.

### 5. UI Feedback and Ergonomics

**Status (2026-07-02): rescoped.** The owner is planning a larger redesign
(look-and-feel update + a reflow around the actual weekly cycle: Plan → Shop →
Cook, including an elevated cooking mode), so milestone 5 was split:
**mini-M5** (the redesign-proof subset, shipped on
`codex/ui-feedback-ergonomics`): home-screen icon + web manifest +
theme-color, per-page titles, friendly error mapping (`lib/errors.ts`),
`aria-live` `StatusMessage` adopted on all screens, session-flash fix, and the
`ensureUserSettings` duplicate-call fix. The page-specific ergonomics
(tap-target retrofits, plans-grid reorder, scroll-into-view) are deferred into
the redesign, which follows milestone 6 (component hardening) as its
foundation. "Keep data between tabs" moves to milestone 6's data-hook
extraction.

Planned branch: `codex/ui-feedback-ergonomics`

Scoped by the 2026-06-11 UI audit. Accessibility fixes are folded into each
track rather than a separate milestone.

- Feedback and status overhaul: show save and error messages near the action
  with `aria-live` announcement and auto-dismiss; surface failures clearly on
  mobile.
- Mobile ergonomics: 44px-equivalent tap targets for text buttons,
  scroll-into-view when the recipe editor opens, reorder the plans page so
  the week grid comes first, accessible labels for serving controls, and
  `apple-touch-icon` plus `theme-color` for iPhone home-screen use.
- Loading and caching polish: remove the session flash, keep fetched data
  between tab switches, add skeleton states, and add per-page titles.

Acceptance:

- Status messages are visible without scrolling and announced to assistive
  technology on all five screens.
- Primary touch controls meet tap-target guidance on a 375px viewport.
- Navigating between tabs shows previously loaded data without a blank
  loading flash.

### 6. Component Hardening

**Status (2026-07-02): done — slices 1–4 merged**, as the foundation for the
reflow ([redesign-brief.md](redesign-brief.md)): slice 1 (shared date
formatters, PR #7), slice 2 (`useGroceryList` hook, PR #9), slice 3 (`usePlan`
hook, PR #10 — plans page 1,091 → 571 lines), slice 4 (`useRecipes` hook +
shared `PlanSlotCell`, PR #12 — recipes page 859 → 359 lines, plans page
571 → 266). Settings-defaults single source of truth was split out of M6 as
its own follow-up (owner decision, 2026-07-02) — tracked in Deferred Fixes
below and [design-flags.md](design-flags.md). Each slice was behavior-neutral
(mechanical-diff verified) and CI-guarded, one PR per slice. Acceptance:
behavior compatible ✓; shared date/grocery logic has vitest coverage, while
hook/UI-interaction coverage remains an open flag.

Branches: `codex/component-hardening` (slices 1–2), `codex/plans-data-hook`
(slice 3), `codex/recipes-hook-slot-cells` (slice 4).

- Split oversized recipe, planning, and grocery route components.
- Centralize shared date and Supabase data-access logic.
- Improve retry and failure feedback without redesigning workflows.

Acceptance:

- User-visible behavior remains compatible.
- Shared logic has focused automated coverage.

## Deferred Fixes (from the 2026-06-11 audit)

Real issues confirmed in code but deliberately excluded from the current
reliability scope. Details in
[CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md).

- ~~Dashboard loads items for only the 4 newest plans~~ — fixed by the
  reflow's Today screen (2026-07-02): items load for the date-relevant
  current plan and its successor (`lib/hooks/use-today.ts`).
- Plan version bumps fire for changes that do not affect groceries (eating-out
  notes, leftover edits), and the grocery page regenerates silently on load.
  Milestone 4 makes this harmless to user state; scoping the bumps and
  prompting before regeneration remain open.
- `ensureUserSettings` runs twice per sign-in, and default settings values are
  duplicated across three files inconsistently with the SQL defaults. (The
  duplicate call was fixed in mini-M5; the defaults single source of truth is
  a standalone follow-up per the 2026-07-02 owner decision.)
- Raw Supabase error strings render in the UI; no route-level error or loading
  boundaries.
- No optimistic UI; plan mutations feel sluggish on mobile.
- `supabase/schema.sql` mixes baseline DDL with historical inline `ALTER`
  statements.

## Deferred Fixes (from the 2026-06-11 UI audit)

Details in [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md).

- Auth flow completion: sign-up confirmation messaging, password reset,
  friendlier auth errors.
- Mobile Lunch/Dinner labels rely on `nth-child` CSS coupling (M6 kept it
  unchanged — strict behavior neutrality; the markup now renders from
  `components/plan-slot-cell.tsx`; candidate for the reflow's Plan screen).
- Screen wake-lock shipped with the reflow's Cook mode (PR #13, 2026-07-02);
  richer empty states and dark mode beyond the Cook takeover remain open.

## Deferred Ideas

- Recipe import from URL or pasted text.
- OCR-assisted recipe capture.
- Unit conversions during grocery grouping.
- Meal-plan templates.
- Recipe sharing, nutrition data, and public-product features.
- PWA and offline support.
