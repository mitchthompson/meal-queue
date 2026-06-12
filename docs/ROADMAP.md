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
  operating procedures by following `docs/README.md`.
- No obsolete document presents completed work as a future plan.

### 1. Reliability Foundation

Merged: `7cfbab2` on 2026-06-11

- [x] Add Vitest and core test scripts.
- [x] Extract testable date, ingredient scaling, and grocery grouping
  functions.
- [x] Add tests for those behaviors.
- [x] Establish `supabase/migrations/` while keeping `schema.sql` canonical.
- [x] Patch Next.js within major version 15 and resolve npm audit findings.

Acceptance:

- [x] `npm run test`, `npm run typecheck`, and `npm run build` pass.
- [x] Migration naming and application procedures are documented.

## Active Milestones

The 2026-06-11 code audit (`docs/CODE_AUDIT_2026-06-11.md`) confirmed
milestones 2-4 as the agreed scope, in this order, implemented with Postgres
functions (RPCs) and triggers applied through the Supabase SQL editor.

The 2026-06-11 front-end UI audit (`docs/UI_AUDIT_2026-06-11.md`) added
milestone 5 (UI feedback and ergonomics), which runs after the reliability
core and before component hardening.

### 2. Atomic Recipe Saves

Planned branch: `codex/atomic-recipe-saves`

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

Planned branch: `codex/plan-integrity`

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

Planned branch: `codex/grocery-state-preservation`

- Add a transactional grocery regeneration function.
- Give generated items stable identities within a plan (identity key without
  the version prefix: normalized name, unit, pantry classification).
- Preserve checked, on-hand, and pantry override state for unchanged items.
- Remove obsolete rows only after replacement generation succeeds.

Acceptance:

- Regeneration never exposes a partially rebuilt list.
- Unchanged items retain user state; removed ingredients disappear.

### 5. UI Feedback and Ergonomics

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

Planned branch: `codex/component-hardening`

- Split oversized recipe, planning, and grocery route components.
- Centralize shared date and Supabase data-access logic.
- Improve retry and failure feedback without redesigning workflows.

Acceptance:

- User-visible behavior remains compatible.
- Shared logic has focused automated coverage.

## Deferred Fixes (from the 2026-06-11 audit)

Real issues confirmed in code but deliberately excluded from the current
reliability scope. Details in `docs/CODE_AUDIT_2026-06-11.md`.

- Dashboard loads items for only the 4 newest plans; with several future plans
  the current week can render empty (`app/page.tsx`).
- Plan version bumps fire for changes that do not affect groceries (eating-out
  notes, leftover edits), and the grocery page regenerates silently on load.
  Milestone 4 makes this harmless to user state; scoping the bumps and
  prompting before regeneration remain open.
- `ensureUserSettings` runs twice per sign-in, and default settings values are
  duplicated across three files inconsistently with the SQL defaults.
- Raw Supabase error strings render in the UI; no route-level error or loading
  boundaries.
- No optimistic UI; plan mutations feel sluggish on mobile.
- `supabase/schema.sql` mixes baseline DDL with historical inline `ALTER`
  statements.

## Deferred Fixes (from the 2026-06-11 UI audit)

Details in `docs/UI_AUDIT_2026-06-11.md`.

- Auth flow completion: sign-up confirmation messaging, password reset,
  friendlier auth errors.
- Mobile Lunch/Dinner labels rely on `nth-child` CSS coupling (fits milestone
  6 component hardening).
- Screen wake-lock during cooking focus mode, richer empty states, dark mode.

## Deferred Ideas

- Recipe import from URL or pasted text.
- OCR-assisted recipe capture.
- Unit conversions during grocery grouping.
- Meal-plan templates.
- Recipe sharing, nutrition data, and public-product features.
- PWA and offline support.
