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

- GitHub Actions CI: an app-checks job (`npm ci` + lint + typecheck + test +
  build with placeholder `NEXT_PUBLIC_*` env; lint added with the ESLint flat
  config in PR #23) and a db-tests job (ephemeral local Supabase stack via the
  CLI + pgTAP; no cloud credentials).
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

Follow-ups: all cleared. Done: pin the CLI version (2.109.0); confirm
`config.toml` `major_version` against prod (set to 17 — prod is Postgres 17.6,
2026-07-01); configure ESLint + add a lint step (PR #23, 2026-07-03); bump
`actions/checkout` and `actions/setup-node` to `@v5` (2026-07-03, merge
`2e8bc09`, clearing the Node-20 runtime deprecation); add a CI guard diffing
the baseline against `schema.sql` (2026-07-03 — the db-tests "Baseline schema
matches schema.sql" step, run before `supabase start`, fails on drift with the
regenerate command).

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
(tap-target retrofits, plans-grid reorder, scroll-into-view) were deferred into
the redesign — the plans-grid reorder and scroll-into-view items were both
closed by the reflow + review round 1 (flat day rows; the recipe editor now
takes over the mobile screen, PR #17, 2026-07-02). "Keep data between tabs"
moved to milestone 6's data-hook
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

### 7. V2 Sweep (reflow round 2)

**Status: done — all four PRs shipped 2026-07-02 (token fix #19, Settings
#20, Recipes library/editor #21, recipe detail #22).**
The reflow rebuilt only the four cycle screens; token set v2 landed at the
token level, but hardcoded old-palette values survived in `app/globals.css`
and the non-cycle screens kept their pre-reflow layout language. The owner
asked for a full sweep (2026-07-02 review session); offenders were
catalogued in the "Pre-reflow remnants" flag in
[design-flags.md](design-flags.md).

- [x] **Part 1 — token fix (mechanical, first):** done — PR #19
  (`codex/v2-token-sweep`), merged + deployed 2026-07-02. All 20 literals →
  v2 tokens; acceptance grep hits `:root` only; no layout changes; verified
  22/22 computed-style assertions at 390px on the local stack.
- [ ] **Part 2 — per-screen passes** in the reflow rhythm (branch/PR each,
  review-board mocks for owner sign-off before code):
  - [x] **Settings** — done, PR #20 (`codex/v2-settings`), merged + deployed
    2026-07-02 per round-2 board verdicts (ST1: B iOS-style rows, ST2
    full-width teal save, ST3 page title + card labels); live save
    round-trip verified.
  - [x] **Recipes library + editor** — done, PR #21 (`codex/v2-recipes`),
    merged + deployed 2026-07-02 per round-3 board verdicts (RC1: A cards
    without the serves line, RC2 header language + teal links, RC3 sample
    data removed outright, RC4 stacked editor, RC5 full-width save); also
    fixed the never-displaying save confirmation.
  - [x] **Recipe detail** — done, PR #22 (`codex/v2-recipe-detail`),
    merged + deployed 2026-07-02 per round-4 verdicts (RD1: B flat rows
    both lists, RD2 full-width Start cooking, RD3 header language + 44px
    stepper, RD4 pantry-badge cascade quirk fixed at the root, RD5
    breadcrumb + one-row title actions).
- Auth screen intentionally excluded — it folds into the deferred auth-flow
  work (sign-up confirmation, password reset) whenever that is scheduled.

Acceptance (all met, 2026-07-02):

- [x] No hardcoded palette values outside the `:root` token definitions
  (`grep -E '#[0-9a-fA-F]{3,8}' app/globals.css` hits tokens and true
  one-offs only, each justified by a comment).
- [x] Settings, Recipes library/editor, and recipe detail read as
  token-set-v2 screens on a 390px viewport, owner-verified from
  review-board shots (rounds 2–4, all pins resolved).
- [x] Behavior neutral throughout, with three owner-approved exceptions
  (serves line removed, sample-data seeder removed, save-confirmation fix).

### 8. Recipe Import (in-app)

**Status: done (2026-07-04) — all phases (A/B/C/D) shipped & deployed.** PR 1
(server route, PR #28) and PR 2 / Phase C (import UI, PR #29) are both merged to
`main` and live on Vercel prod; only the owner real-device pass remains. Full
builder-ready execution spec: [plans/recipe-import.md](plans/recipe-import.md)
(owner interviewed; all design forks decided and recorded in its §1 table).

Add recipes from the app itself (today they enter via the MCP server in a
Claude Code session): paste recipe text (primary — NYT Cooking is paywalled
and unfetchable) or fetch an open-site URL → LLM parse (Claude Haiku 4.5,
server-side) → dedicated review/edit screen → save via the existing
`save_recipe` RPC. iPhone-first. Zero new npm dependencies, zero schema
changes by design.

- Phase A — review-board round 5 mocks (IM1–IM7). **Done; verdicts collected
  2026-07-04 and recorded in [decisions.md](decisions.md) (IM1 B · IM2 as
  shown · IM3 A amber · IM4 B · IM5 as shown · IM6 OK · IM7 A).**
- Phase B — PR 1 `codex/import-api`: the app's first API route
  (`POST /api/import-recipe`) + `lib/import/*` helpers with vitest; merges
  inert. ADR for the two architectural firsts (server code, LLM dependency).
  **Done — merged 2026-07-04 (PR #28, `11834f9`), deployed to Vercel prod.**
- Phase D — senior review + spec-compliance pass. **Done 2026-07-04: 7 fixes
  (SSRF hardening, step-range, reuse), all 4 deviations resolved, live B13
  smoke green; vitest 119/119.**
- Phase C — PR 2 `codex/import-ui`: import flow + review screen +
  behavior-neutral `saveRecipeForm` extraction. **Done — merged 2026-07-04
  (PR #29, `88a6bc5`), deployed. Phase D `/code-review` fixed 3 bugs
  (abort-vs-reset coordination, `?edit`+`?import` mutual-exclusion, paywall
  focus) + 3 cleanups; vitest 125/125, `verify-recipes-pass` 22/22 (C1 neutral)
  + `verify-import-pass` 26/26.**

Owner gate: Anthropic Console setup (`ANTHROPIC_API_KEY`, ~$10/mo spend cap)
before Phase B smoke tests.

Acceptance:

- A recipe pasted from NYT Cooking on the iPhone reaches the review screen
  parsed (13-unit vocabulary, pantry flags, tags from the existing list only)
  and saves through `save_recipe` with the original text captured in
  `instructions_raw`.
- An open-site URL import round-trips the same way; a paywalled URL fails
  soft into the paste path (amber redirect, not an error).
- The existing editor's behavior is byte-identical after the
  `saveRecipeForm` extraction (existing verify script re-run green).

## Scoped Milestones (2026-07-05 scoping session)

All seven were interviewed and specced in one session (owner verdicts recorded
in each spec's §1 table); each has a builder-ready spec in `docs/plans/`
written for a lower-capability executor. **M9 shipped 2026-07-05 (PR #33,
deployed); M10 complete 2026-07-05 (PR #34 + PR #35, deployed); M11 shipped
2026-07-11 (PR #37, deployed, owner prod device pass done) — M12-M15 remain to
build** — the owner picks the order and gives the
go-ahead per milestone. Recommended order below
(dependencies noted); board pins for M10/M11/M13/M15 can bundle into one review
round; M14 needs its own round.

### 9. Resilience (error/loading boundaries + raw-error sweep) — DONE

**Done 2026-07-05: PR #33 (`codex/error-boundaries` → `main` `8f1cd46`),
deployed.** Root `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx`
boundaries, a recipe-detail 404 (`PGRST116` → render-time `notFound()`), the
`toAuthErrorMessage` mapper, and the sweep of 17 `setError(x.message)` sites
through `toErrorMessage`/`toAuthErrorMessage`. Board pin EB1 signed off; senior
review clean; vitest 138/138; harnesses 15/22/26. Zero schema, zero deps. Its
error plumbing is now available to M10 and M11.

Spec: [plans/error-boundaries.md](plans/error-boundaries.md) · Branch `codex/error-boundaries` (merged + deleted)

### 10. Responsiveness (Shop stale banner + optimistic writes)

Spec: [plans/responsiveness.md](plans/responsiveness.md) · Branches
`codex/shop-stale-banner` (PR 1) and `codex/optimistic-writes` (PR 2) — both
merged + deleted. **Milestone 10 complete 2026-07-05.**

**PR 1 done 2026-07-05: PR #34 (`codex/shop-stale-banner` → `main` `41fa28b`),
deployed.** An amber staleness banner + explicit Generate/Update button replaces
the Shop page's silent regenerate-on-load (closes the "prompting before
regeneration" half of the old over-triggered-regeneration flag; the
version-scoping half was closed by M3). Board pin SB1: A (amber); senior review
applied one fix (banner in-flight flicker on plan switch); `verify-shop-pass`
22/22; zero schema, zero deps.

**PR 2 done 2026-07-05: PR #35 (`codex/optimistic-writes` → `main` `1d16ef8`),
deployed.** Item-level mutations (grocery toggle/bucket/pantry/on-hand, plan
adjustServing/removeItem/addMeal) apply optimistically with targeted functional
rollback; the plan/recipe form saves dropped their blocking refetches (the atomic
`save_recipe` RPC await stays). Senior `/code-review` (high) found + fixed 3
issues (refresh-after-write rollback regression, concurrent stale-snapshot
clobber → hardened to per-item rollback, same-ms temp-id collision). Closes the
"no optimistic UI" flag. `verify-optimistic-pass` 16/16 (render <200ms under a
1500ms-delayed network, rollback + red error on abort); no visual surface, no
board pin; zero schema, zero deps.

### 11. Password reset — DONE

Spec: [plans/password-reset.md](plans/password-reset.md) · Branch
`codex/password-reset` (merged + deleted)

"Forgot password?" → `resetPasswordForEmail` → `/reset-password` route →
`updateUser`. Sign-up confirmation messaging stays deferred (owner decision
2026-07-05). Uses M9's `toAuthErrorMessage`.

**Done 2026-07-11: PR #37 (`codex/password-reset` → `main` `7e66dd5`),
deployed; the owner completed the prod real-device pass the same day (live
iPhone Safari reset, confirmed working).** Built 2026-07-06:
`auth-gate.tsx` forgot-password link + `requestPasswordReset`; new
`app/reset-password/{page,layout}.tsx`. Senior `/code-review` (high) clean; 3
low-severity notes applied (`disabled={busy}`, toggle-clears-status, title case).
Board round **AR** caught a real sign-in link collision → **owner picked AR1: A**
(stacked links, `.auth-links` in `app/globals.css`); **AR2 (reset page): signed
off 2026-07-11, verdict A — kept as built.** `verify-reset-pass.mjs` 25/25 (real
Mailpit round-trip), vitest 138/138, build 13 routes; PR #37 CI green, `main`
post-merge CI green first run. Zero schema, zero deps.
**All owner gates cleared 2026-07-11:** redirect URLs configured
(`/reset-password`, prod + `localhost:3000`, Site URL confirmed) · merge word
given · prod real-device pass done.

### 12. Grocery unit merge (dimension-aware grouping)

Spec: [plans/unit-merge.md](plans/unit-merge.md) · Branch `codex/grocery-unit-merge`

**DB milestone (fifth migration; full ritual).** `units.base_factor` column +
a rewritten `regenerate_grocery_list` that merges volume-with-volume and
weight-with-weight (display in the largest contributing unit); count units
never merge; old-key rows normalized state-intact (`bool_and`). pgTAP grows to
≥130. Independent of M9–M11; pairs naturally after M10's banner.

### 13. Plan copy ("Start from a previous week")

Spec: [plans/plan-copy.md](plans/plan-copy.md) · Branch `codex/plan-copy`

A "Start from" select in the create-plan sheet copies a previous week's items
onto the new dates (offset-shifted; out-of-range items skipped and counted;
leftover links remapped). Chosen over a templates table (owner decision
2026-07-05) — zero schema. Pure mapping logic lands vitest-covered in
`lib/plan-copy.ts`. After M10 (touches `createPlan`).

### 14. Dark mode (system-follow)

Spec: [plans/dark-mode.md](plans/dark-mode.md) · Branch `codex/dark-mode`

One `@media (prefers-color-scheme: dark)` primitives-override block +
scheme-aware `themeColor`; Cook takeover and Shop order bar stay verbatim.
Dark token VALUES are board-gated (its own mock round, pins DM1–DM3) — nothing
ships unapproved. Template-wide change: both-scheme sweep + Needs-Mitchell
real-device digest required. Any time; best late so new UI (banners, empty
states) is swept once.

### 15. Richer empty states

Spec: [plans/empty-states.md](plans/empty-states.md) · Branch `codex/empty-states`

Shared `EmptyState` component (the Today-card pattern generalized) replacing
the four weak page-level empties (Recipes ×2, Shop no-plan, Plan no-plans),
copy locked in the spec pending board pins ES1–ES2. Zero schema, zero deps.
Last; benefits from M13's sheet and M14's dark sweep.

### 16. Step↔ingredient link (accurate cook-mode chips) — candidate, forks not locked

Spec: [plans/step-ingredients.md](plans/step-ingredients.md) · Branch
`codex/step-ingredients` (proposed)

Scoped 2026-07-11 from real-use feedback (wrong chips while cooking One-Pot
Chicken and Rice). **DB milestone** (takes the next migration slot after
whichever of M12/this ships first): the import LLM emits per-step
`ingredient_indexes`, `save_recipe` resolves them to a new nullable
`recipe_steps.ingredient_ids uuid[]` (both-shape `p_steps` keeps every legacy
caller working), and cook mode trusts the mapping — the name-match heuristic
becomes fallback-only for unmapped recipes. Unlike M12–M15 the §2 owner forks
are NOT yet locked — needs an owner interview before build. The cheap
interim fixes (zero-amount "to taste" display + the keep-source-step-boundaries
prompt rule) shipped 2026-07-11, independent of this milestone.

## Deferred Fixes (from the 2026-06-11 audit)

Real issues confirmed in code but deliberately excluded from the current
reliability scope. Details in
[CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md).

- ~~Dashboard loads items for only the 4 newest plans~~ — fixed by the
  reflow's Today screen (2026-07-02): items load for the date-relevant
  current plan and its successor (`lib/hooks/use-today.ts`).
- ~~Plan version bumps fire for changes that do not affect groceries (eating-out
  notes, leftover edits), and the grocery page regenerates silently on load.~~
  The scoping half was resolved by milestone 3's grocery-scoped triggers; the
  prompting-before-regeneration half is promoted to milestone 10
  ([plans/responsiveness.md](plans/responsiveness.md), 2026-07-05).
- ~~`ensureUserSettings` runs twice per sign-in, and default settings values
  are duplicated across three files inconsistently with the SQL defaults.~~
  Both done: the duplicate call was fixed in mini-M5, and the defaults single
  source of truth landed 2026-07-03 (`DEFAULT_USER_SETTINGS` in
  `lib/constants.ts`, mirroring the SQL null/unset order/pickup defaults;
  direct to `main`, merge `aada18f`).
- ~~Raw Supabase error strings render in the UI; no route-level error or loading
  boundaries.~~ — promoted to milestone 9
  ([plans/error-boundaries.md](plans/error-boundaries.md), 2026-07-05).
- ~~No optimistic UI; plan mutations feel sluggish on mobile.~~ — promoted to
  milestone 10 ([plans/responsiveness.md](plans/responsiveness.md), 2026-07-05).
- ~~`supabase/schema.sql` mixes baseline DDL with historical inline `ALTER`
  statements.~~ — done 2026-07-03: redundant history dropped, the two real
  CHECK constraints folded into the `meal_plan_items` CREATE TABLE (735 → 699
  lines). Proven schema-neutral (fresh-build `pg_dump` diff empty, pgTAP
  108/108); prod untouched; baseline copy regenerated for the CI drift guard.

## Deferred Fixes (from the 2026-06-11 UI audit)

Details in [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md).

- Auth flow completion: ~~password reset, friendlier auth errors~~ — promoted
  2026-07-05: password reset to milestone 11
  ([plans/password-reset.md](plans/password-reset.md), **shipped 2026-07-11,
  PR #37**), friendlier auth errors
  to milestone 9's `toAuthErrorMessage`. Sign-up confirmation messaging stays
  deferred (owner decision 2026-07-05: single household, accounts already
  provisioned).
- ~~Mobile Lunch/Dinner labels rely on `nth-child` CSS coupling~~ — fixed by
  the reflow's Plan screen (2026-07-02): day rows carry explicit L/D labels
  in the markup; the `::before` injection was removed.
- Screen wake-lock shipped with the reflow's Cook mode (PR #13, 2026-07-02);
  ~~richer empty states and dark mode beyond the Cook takeover remain open~~ —
  both promoted 2026-07-05: dark mode to milestone 14
  ([plans/dark-mode.md](plans/dark-mode.md)), empty states to milestone 15
  ([plans/empty-states.md](plans/empty-states.md)).

## Deferred Ideas

- ~~Recipe import from URL or pasted text.~~ — promoted to milestone 8
  (2026-07-03, spec: [plans/recipe-import.md](plans/recipe-import.md)).
- OCR-assisted recipe capture.
- ~~Unit conversions during grocery grouping.~~ — promoted to milestone 12
  (2026-07-05, spec: [plans/unit-merge.md](plans/unit-merge.md)).
- ~~Meal-plan templates.~~ — promoted to milestone 13 as plan copy, the
  no-schema variant (2026-07-05, spec: [plans/plan-copy.md](plans/plan-copy.md)).
- Recipe sharing, nutrition data, and public-product features.
- PWA and offline support.
