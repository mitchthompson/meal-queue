# Decisions

This document records choices that should survive individual implementation
sessions. Add a dated entry when a product or technical decision changes. Mark
replaced decisions as superseded rather than silently deleting them.

## Active Decisions

### Product Scope

- Meal Queue is optimized for personal or household use, not public-product
  scale.
- ~~Lunch and dinner are optional planning slots.~~ Superseded 2026-07-02:
  days are flat meal lists (see **Flat Days** below).
- A day may contain any number of meals — cooked recipes, leftover
  references, or eating-out notes. (Reworded 2026-07-02 from "a meal slot
  may contain multiple recipes…" when slots were removed.)
- Meal plans use explicit `start_date` and `end_date` values rather than a
  fixed calendar week.
- Order and pickup weekdays provide defaults, while each plan stores its actual
  dates so historical plans remain accurate.
- The primary targets are desktop browsers and iPhone Safari.

### Recipes and Ingredients

- Structured `recipe_steps` are canonical. Optional `instructions_raw` is kept
  for imports and debugging.
- Ingredient units come from a controlled list.
- Grocery quantities combine only when normalized ingredient name, unit, and
  pantry classification match exactly. Unit conversion is deferred.
- Tags are user-created, with starter suggestions supplied by the app.

### Recipe Import (planned 2026-07-03 — spec: [plans/recipe-import.md](plans/recipe-import.md))

Owner-decided at the planning interview; locked for the build (the full ADR
for the architectural firsts lands with PR 1):

- Parsing is LLM-powered: Claude Haiku 4.5 (pinned `claude-haiku-4-5-20251001`)
  called server-side via plain `fetch` — no SDK, no new npm dependency.
- One new API route (`POST /api/import-recipe`) — the app's first server-side
  code. It parses only and never writes the database; saving stays client-side
  through `save_recipe` (auth.uid RLS path).
- Both avenues ship in v1, paste-first: NYT Cooking is paywalled, so pasted
  text is the primary path and a paywalled URL fails soft into paste.
- Dedicated review screen (not editor prefill), fully editable in the editor
  idiom, with the original text in a collapsible panel.
- No schema change: provenance is a `Source: <url>` first line inside
  `instructions_raw`, which also captures the original text.
- Imported tags come only from the user's existing tag vocabulary (LLM may not
  invent tags).
- `mcp/` stays a walled-off separate package: its extraction logic is copied
  into `lib/import/`, never imported.
- Build handoff pattern: spec is written for a lower-capability builder model,
  with STOP gates and a senior-model review (Phase D) before any merge.

### Recipe Import — architectural firsts ADR (PR 1, `codex/import-api`, 2026-07-03)

As-built record for the two firsts introduced by the import API route. Built on
`codex/import-api`; verification gate green (lint, typecheck, vitest 114/114,
`next build` with `/api/import-recipe` as a node route and no build-time key
read). Not committed, smoke-tested, or merged: pending the owner's
`ANTHROPIC_API_KEY` (STOP ②) and senior review (Phase D).

- **Broken invariant (deliberate):** the app was 100% client components with zero
  API routes ([routes](routes.md)). `POST /api/import-recipe` is the first
  server-side code. Why now: NYT Cooking is paywalled (paste is the primary
  path) and turning messy paste/HTML into structured recipe rows needs an LLM,
  whose API key must never reach the browser.
- **First paid external dependency:** the Anthropic API, Claude Haiku 4.5, pinned
  `claude-haiku-4-5-20251001`, called via plain `fetch` (no SDK, no new npm
  dependency) with structured JSON output (`output_config.format`, verified GA
  for Haiku with no beta header). No `effort` param (unsupported on Haiku).
- **Parse-only:** the route never reads or writes app tables. It auth-gates on
  the caller's Supabase token and returns a draft; saving stays client-side
  through `save_recipe` (auth.uid RLS), unchanged. Reuses the `NEXT_PUBLIC_*`
  vars server-side (no new Supabase env).
- **Cost posture:** ~$0.006–0.01 per import; hard ceiling ~$0.03 (input caps +
  `max_tokens` 4096). Perimeter = auth gate + Anthropic Console monthly spend cap
  as the abuse backstop; no rate limiter (single household, no KV in the stack).
  Key is server-only (no `NEXT_PUBLIC_` prefix).
- **Relationship to `mcp/`:** separate lifecycle; the extraction, schema, and
  pantry logic is **copied into `lib/import/` (provenance-headered), not shared
  or imported**, and the two are not merged now.
- **Deviation flagged:** four error-message strings had their em-dashes replaced
  with periods to honor the owner's no-em-dash-in-copy rule; wording is otherwise
  verbatim from the spec. See [design-flags](design-flags.md).

### Grocery State

- Grocery rows are persisted so checklist state survives page navigation.
- Pantry staples, on-hand state, and checked state belong to a specific plan.
- Reliability work must preserve unchanged user state when a grocery list is
  regenerated.

### Engineering Workflow

- Existing Supabase data is live data and must be preserved with additive
  migrations and preflight checks.
- Implementation work uses focused branches prefixed with `codex/`.
- Pull requests are a risk-management tool rather than a requirement for every
  change. Use them for database migrations, broad refactors, risky behavior
  changes, or whenever a deliberate review checkpoint is useful.
- Small, low-risk, and documentation-only changes may be committed directly to
  `main` after review and verification.
- Useful incomplete work stays on a pushed feature branch with an explicit
  handoff. Checkpoint commits may be squashed before merge.
- Documentation updates are part of each completed change's acceptance
  criteria.
- [current-state.md](current-state.md) describes present reality,
  [roadmap.md](roadmap.md) describes future work, and
  [progress-log.md](progress-log.md) records completed outcomes.
- Every session ends with the documented session-wrap process so the next
  session can resume without relying on conversation history.

### Reliability Implementation (2026-06-11)

- Database reliability fixes (atomic recipe saves, version increments, grocery
  regeneration) are implemented with Postgres functions and triggers rather
  than client-side orchestration. Functions use security-invoker semantics so
  row-level security continues to apply; the service-role MCP path is the
  deliberate exception.
- The reliability scope is milestones 2-4 in roadmap order. Quick-win fixes,
  grocery-staleness redesign, and the component refactor are deferred and
  recorded in [roadmap.md](roadmap.md) so they are not lost.
- The `mcp/` recipe-import server source is tracked in Git. `.mcp.json`,
  build output, and `node_modules` remain ignored because they hold secrets or
  generated content.

### Front-End Improvements (2026-06-11)

- UI improvement work (feedback overhaul, mobile ergonomics, loading polish)
  runs after the reliability core so data-integrity fixes land first.
- Accessibility fixes are folded into related UI work rather than tracked as
  a separate milestone.
- Auth flow completion (sign-up confirmation messaging, password reset) is
  deferred until a need arises; this is a single-household app.

### Dates and Migrations

- Meal-plan dates are calendar dates, not UTC timestamps. Shared date helpers
  construct `YYYY-MM-DD` values from local calendar fields to avoid timezone
  shifts.
- `supabase/schema.sql` remains the canonical full-schema reference.
- New database changes use timestamped, forward-only files under
  `supabase/migrations/`. There is no synthetic baseline migration for the
  already-live database.

### Documentation and Design System (2026-06-19)

- The lowercase-kebab documentation system is canonical. The old UPPERCASE docs
  are renamed to their lowercase-kebab equivalents (for example
  [product.md](product.md), [architecture.md](architecture.md),
  [current-state.md](current-state.md)). `CLAUDE.md` at the repo root is the
  always-loaded anchor that points into the docs set and holds the canonical
  end-of-session checklist.
- The design source of truth lives in the repo, not in an external design tool
  (no Figma). Data truth is `supabase/schema.sql` plus
  [data-model.md](data-model.md); UI truth is the CSS-variable tokens in
  `app/globals.css` plus [design-system.md](design-system.md); per-page intent
  lives in the per-page docs under `docs/pages/`. Confirm against these live
  files before building; a missing value is flagged in
  [design-flags.md](design-flags.md), never invented.
- No CSS class prefix is used. Meal Queue is a single self-contained app that
  does not share the DOM with anything else, so the CSS-variable token system in
  `app/globals.css` is the namespace. All color, spacing, and typography flow
  through the `--color-*` variables and their semantic aliases (`--bg`,
  `--surface`, `--ink`, `--muted`, `--brand`, `--brand-2`, `--line`, and
  related); one-off hex, font, or spacing values are never inlined in
  components.

### CI, Test Harness, and Version-Bump Policy (2026-06-27)

- A testing foundation is built **before** applying the reliability migrations to
  prod ("plan B"), because there is no staging environment. Free approach:
  logical backups via `pg_dump` / `supabase db dump` (Supabase Pro PITR is not
  required), and an ephemeral local Supabase stack as "staging."
- The **Supabase CLI is introduced for local/CI testing only.** Prod schema
  changes stay hand-applied through the Supabase SQL editor; `supabase db push`
  is not run against the live project.
- CI is GitHub Actions: an app-checks job (`npm ci` + typecheck + test + build)
  and a db-tests job (local Supabase stack + pgTAP), with **no cloud credentials**
  — the DB job uses a throwaway local database on the runner. The DB job needs no
  local Docker (GitHub runners provide it).
- The `save_recipe` version bump is **diff-based**: it bumps referencing plans
  only when the recipe's ingredient identity set actually changes, avoiding the
  over-triggered grocery regeneration that always-bumping would cause.
- The MCP `save-recipe` cutover to the `save_recipe` RPC is a deferred follow-up
  on the same branch (not a blocker for applying the milestone 2 migration).

### Explicit Data API Grants and CI Pinning (2026-07-01)

- Table privileges for `anon`/`authenticated`/`service_role` are declared
  **explicitly** in the schema (migration `20260701220327_data_api_grants.sql`)
  rather than relying on Supabase's legacy implicit defaults, which fresh
  local/CI stacks no longer grant (`auto_expose_new_tables` default flip,
  2026-05-30). RLS remains the security gate; the grants are the capability
  layer beneath it. On prod the migration is a no-op documenting reality.
- CI pins the Supabase CLI to an exact release (2.109.0) instead of `latest`;
  bumps are deliberate. `supabase start` excludes services the DB-test path
  does not use, and the pgTAP step fails on pg_prove's `NOTESTS` result so
  broken test discovery can never read as green.
- Local DB testing runs on Colima (free/open container runtime) — the
  "no local Docker" constraint is retired. Prod schema changes remain
  hand-applied via the SQL editor; **merge order rule confirmed by incident:**
  apply DB migrations to prod *before* merging dependent client code, because
  merging to `main` auto-deploys production on Vercel.

### Plan Integrity Mechanics (2026-07-02)

- Plan version bumps are **database triggers scoped to grocery-relevant
  changes** (cook items added/removed; recipe_id or serving_multiplier
  changed) — extending the diff-based philosophy from milestone 2. The client
  performs no version writes.
- Cross-row invariants are BEFORE-trigger validations with **row locks**
  (`for no key update` on the parent plan; `for share` on a leftover source)
  so the invariants hold under concurrency, not just sequentially. NULL
  leftover links remain legal (orphans from deleted cook items are valid
  history).
- **Apply order rule for trigger/behavior migrations:** apply to prod BEFORE
  merging the dependent client change. For M3 specifically, the
  migration-first window double-bumps harmlessly; client-first would silently
  stop grocery invalidation.

### Grocery Identity and Staleness (2026-07-02)

- Grocery rows have a **stable identity**: `source_key` is
  `lower(trim(name))|unit_code|pantry-classification` with no version prefix,
  unique per plan. Regeneration is a transactional **upsert by identity**
  (`regenerate_grocery_list`), so user state (`is_checked`, `is_on_hand`, and
  the manual pantry override) survives for any ingredient that persists; the
  recipe-derived pantry classification lives in the identity while the row's
  `is_pantry_staple` stays user-mutable.
- Staleness is plan-level: `meal_plans.groceries_version` records which plan
  version the list was generated from; the list is stale when it differs from
  `version` (bumped only by grocery-relevant changes per milestone 3). The old
  source-key version-prefix convention is retired; legacy rows are normalized
  on their first regeneration without losing state.

### Component Hardening Wrap (2026-07-02)

- **Milestone 6 closes with slices 1–4** (shared date formatters,
  `useGroceryList`, `usePlan`, `useRecipes` + the shared `PlanSlotCell`).
  The settings-defaults single source of truth is **split out of M6 as its
  own follow-up** (owner decision) — tracked in
  [design-flags.md](design-flags.md) and the roadmap's Deferred Fixes; not
  yet scheduled.
- **Slice 4 held strict behavior neutrality** (owner call): the nth-child
  mobile-label CSS coupling was preserved, not restructured. (The shared
  cell was `components/plan-slot-cell.tsx` at the time; the reflow's Plan
  screen later removed the coupling, and the flat-day rework renamed the
  component to `plan-day-items.tsx`.)

### Reflow Release Rails (2026-07-02)

- **Owner pre-approval for the remainder of the reflow** (granted after Cook
  mode shipped and was verified on-device): commits, pushes, and merges for
  the reflow screens (Today, Shop, Plan) may proceed **without per-action
  approval**, on the usual rails (feature branch → PR → green CI → merge).
  Condition: handoff docs are updated as each screen lands. This narrowly
  supersedes the "approval never carries over" rule **for reflow release
  actions only** — schema changes/migrations, dependency changes, and
  live-data writes still require explicit per-action approval.
- **Previews are skipped for the reflow**: the owner is the app's only user
  and tests directly in production after each merge (Cook shipped this way:
  PR #13, on-device verification in prod).
- **The pre-approval expired with the reflow's completion** (all four screens
  merged 2026-07-02). Review round 1 (PRs #17–#18) ran on per-action owner
  approval again: explicit go-ahead to build, explicit "good to merge".

### V2 Sweep Layout Language (2026-07-02, round 2)

- Round-2 board verdicts, with the direction pick explicitly delegated by
  the owner ("they all look good, I'm open to your recommendations"):
  part-1 token mappings confirmed (V1: the pantry badge's amber outline
  stays; V2: opaque white mobile panels are fine), and Settings adopts
  **iOS-style row language** — ST1: B (label left, control right, hairline
  dividers), ST2: full-width teal primary action, ST3: the cycle screens'
  page title + uppercase card labels.
- These verdicts set the layout language for the remaining part-2 screens
  (Recipes library/editor, recipe detail): per-screen `.<screen>-*` class
  groups in `globals.css`, `.page-col` cap, 44px controls, uppercase card
  labels, and a full-width chunky primary action where the screen has one
  dominant action.
- The pantry-badge text-color cascade quirk (`.recipe-meta span` at 0-1-1
  beats `.pantry-badge` at 0-1-0 — pre-existing, also true before the
  sweep) was deliberately preserved through part 1 for mechanical parity
  and is assigned to the recipe-detail pass.

### Flat Days — no lunch/dinner division (2026-07-02, review round 1)

- **The UI has no meal-type concept.** Each plan day is one flat list of
  meals in added (`created_at`) order; quick-add is per-day; Today's hero
  headlines the first cook meal and shows a second as "Also tonight" with a
  "+N more" overflow (owner: most days one meal, occasionally a main plus a
  side — show up to two).
- **`meal_plan_items.meal_type` is vestigial, not dropped**: the NOT NULL
  column and its check constraint stay in the schema; every new row writes
  `'dinner'`; nothing reads it. Why: zero migration risk on live household
  data, zero prod-apply ceremony, and the change stays fully reversible —
  legacy lunch rows keep their value and simply render in their day's list.
  Dropping the column is a possible future migration once the flat model has
  lived a while; it is deliberately unscheduled.
- **Review flow for design changes**: flagged defaults are reviewed on a
  pinned-screenshot board (real local-stack captures; codes like T1/P4);
  the owner answers by code in chat; visual tweaks get CSS-injected variant
  mocks before any code is written (this picked chip variant B). Toolkit
  preserved in `scripts/review-board/`.

## Superseded Decisions

### CI/local-only baseline migration (2026-06-27)

- Supersedes the "There is no synthetic baseline migration for the
  already-live database" clause under **Dates and Migrations** above, but
  ONLY for the local/CI testing path.
- A new file `supabase/migrations/20260101000000_baseline_schema.sql` exists
  purely so a fresh, EPHEMERAL local/CI database (created by
  `supabase start` / `supabase db reset`) can build the full schema before the
  `20260627222320_atomic_recipe_save.sql` migration validates. Without it,
  applying only the `save_recipe` migration to an empty database fails:
  the function body references tables that do not yet exist and
  `check_function_bodies` (on by default) rejects it.
- It is a verbatim, regenerable copy of `supabase/schema.sql`
  (`cp supabase/schema.sql supabase/migrations/20260101000000_baseline_schema.sql`),
  timestamped to sort BEFORE the `save_recipe` migration.
- It is **NEVER applied to prod.** Prod predates the migrations directory and
  stays hand-applied via the Supabase SQL editor; `supabase db push` is not
  used. `schema.sql` remains the canonical full-schema reference.
- Prod risk is negligible: the file never reaches prod, and `schema.sql` is
  idempotent (every `create table` / `create policy` / trigger / constraint is
  guarded with `if not exists` or `drop ... if exists`).
- Resolved 2026-07-01: prod is Postgres 17.6 (confirmed with
  `SHOW server_version;`), and `supabase/config.toml` `major_version` is set
  to 17 so CI/local tests run the same engine as prod.

### iPad coherence — orientation-routed chrome, CSS-only (2026-07-03)

- **Decision:** iPad becomes a supported target by **reusing the existing phone
  and desktop layouts**, routed by orientation — no new tablet layouts, no
  master-detail. Portrait iPads get the phone bottom-tabbar chrome; landscape
  iPads keep the desktop top-nav. Scope chosen by the owner: "make it coherent."
  Full plan: [plans/ipad-support.md](plans/ipad-support.md).
- **Mechanism:** the tabbar/nav-pills/safe-area swap fires on
  `(max-width: 700px), (pointer: coarse) and (max-width: 1024px)` — the coarse
  clause catches every portrait iPad (744–1024px) while landscape iPads
  (≥1180px) stay on desktop chrome. Only nav chrome moves to the shared query;
  the phone **content**-layout rules stay gated at `≤700px`. A separate
  `@media (pointer: coarse)` rule sizes the landscape nav-pills to 44px.
- **Grounded in a Phase-0 sweep** (Chromium, 6 iPad viewports × 6 screens):
  the entire iPad-unique touch-target gap was the four 39px nav-pills; every
  other sub-44px control matched the phone treatment exactly. Only three
  `:hover` rules exist, all with usable resting states, and the one hover-only
  reveal (`.quick-add-hint`) was already `@media (hover: none)`-guarded — so no
  hover work was needed.
- **Owner's answers to the two open questions (accepted, 2026-07-03):**
  1. *Landscape content width* — **accept the desktop 960px shell with side
     gutters** (the minimal choice; revisit only if it reads broken on a real
     device). No landscape-only shell widening.
  2. *12.9″ portrait (1024px)* — **accept the hybrid**: tabbar chrome + desktop
     multi-column content. `max-width: 1024px` is inclusive, so it gets the
     tabbar while keeping desktop content.
- **Phase 3 (content-width sanity) — initially skipped, then implemented after
  on-device feedback (2026-07-03):** the single-column content uses `.page-col`
  (`max-width: 640px`, no centering), left-aligned. That reads as intentional on
  desktop (a constrained column inside the centered 960 shell), but on an iPad
  Pro running the *phone* chrome it stranded a large right gutter (~384px on the
  12.9″). Fix, scoped to the portrait-tablet band only
  (`@media (pointer: coarse) and (max-width: 1024px)`): `.page-col { max-width:
  none; margin-inline: auto }` so the column fills the shell (960 max, centred).
  Portrait now fills — 802px on the 11″, 928px on the 12.9″, balanced gutters.
  **Landscape iPads and desktop keep the 640px reading column unchanged** (the
  rule is capped at 1024px and landscape is ≥1180px). Owner's Q1 acceptance of
  landscape gutters still stands.
- **Not verified on real hardware yet:** the Chromium sweep is necessary but not
  sufficient (WebKit ≠ real Safari). Ships behind a "Needs Mitchell" real-iPad
  digest before the decision is considered proven on-device.
