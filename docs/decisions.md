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

### Recipe Import — round-5 board verdicts (2026-07-04, gate Phase C UI)

Owner verdicts on the IM1–IM7 direction mocks (🍳 artifact). These lock the
import-screen UI before Phase C (`codex/import-ui`) is coded:

- **IM1 (entry surface): B.** Paste / Link mode pills, one input at a time
  (paste-first), rather than A's stacked paste + "or" + URL layout.
- **IM2 (parsing wait): confirmed as shown.** Locked inputs, "Reading recipe…",
  indeterminate bar, Cancel, aria-live at 15s.
- **IM3 (blocked/paywalled URL): A, amber.** Fail soft into paste as an amber
  redirect that keeps the URL and moves focus to the paste box, not a plain red
  error.
- **IM4 (original text on the review screen): B.** Parsed / Original toggle
  pills, rather than A's collapsible panel above the form.
- **IM5 (save cluster): confirmed as shown.** Provenance line + "saved with the
  recipe" note + full-width teal Save.
- **IM6 (what is stored as the original): OK (owner-confirmed 2026-07-04).**
  `instructions_raw` holds the original text verbatim with a `Source: <url>`
  first line for URL imports (paste imports have no source line), not editable
  at review; it is the provenance record and the structured `recipe_steps` are
  canonical. Matches the Phase B build, so no code change.
- **IM7 (Import button placement): A.** Secondary "Import" button beside "New
  recipe" inside the library panel, rather than B's page-head placement by the
  title.

### Recipe Import Phase C — UI build decisions (PR 2, `codex/import-ui`, 2026-07-04)

Durable choices made building the import UI (deviations from the builder spec,
all applied and gate-green; full context in [progress-log.md](progress-log.md)):

- **Shared save path via `saveRecipeForm`.** C1 extracted the editor's save body
  (name-trim → `save_recipe` RPC → id) to a module-level `saveRecipeForm` in
  `lib/hooks/use-recipes.ts`; both the editor and the import review screen call
  it. Behavior-neutral (proven by `verify-recipes-pass` 22/22 + a live
  round-trip). The import route **never** writes the DB — saving stays the
  client `auth.uid()` RPC path.
- **`draftToFormState` lives in a client-free module** (`lib/hooks/draft-to-form.ts`),
  not spread from `blankIngredient()` as the spec suggested. Reason: the browser
  Supabase client throws at load without `NEXT_PUBLIC` env, and vitest sets none —
  so the pure mapper is isolated (type-only imports) to stay unit-testable. Rows
  match `blankIngredient`'s shape with a fresh id.
- **`ImportFlow` takes the `useImport()` return as a `flow` prop.** The page owns
  the hook so it can drive the `import-open` container class and the `?import=1`
  deep link, and keep the editor/import surfaces mutually exclusive
  (`ImportFlow` renders only when `!showEditor`).
- **Paste imports show no "Imported from" line** (no host to name) — the
  "saved with the recipe" note still shows; avoids inventing provenance copy.
- **No-em-dash copy:** the parsing status is "Reading the recipe. This can take
  about 15 seconds." (period, not the spec's em-dash) — the owner house rule,
  matching PR 1's error-copy treatment.
- **Two unpinned CSS values** chosen and flagged in
  [design-flags.md](design-flags.md): `.import-textarea` min-height `9rem`,
  `.import-progress` sweep `1.1s`.

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

### Milestones 9-15 scoping verdicts (2026-07-05)

One session scoped seven milestones into builder-ready specs (`docs/plans/`),
written for a lower-capability executor (owner constraint). Owner verdicts,
all locked in the specs' §1 tables:

- **Dark mode (M14): follow the system only** — one
  `prefers-color-scheme: dark` primitives-override block, no Settings toggle,
  no schema column, no theme-flash JS. Dark token *values* are board-gated
  (mock round DM1–DM3), nothing ships unapproved.
- **Shop staleness (M10 PR 1): banner + explicit button** over silent
  auto-regeneration and over a blocking dialog. The list never writes on load.
- **Auth (M11): password reset only.** Sign-up confirmation messaging stays
  deferred — single household, accounts already provisioned. Friendlier auth
  errors land earlier via M9's `toAuthErrorMessage`. **Build decisions
  (2026-07-06; merged 2026-07-11 as PR #37, deployed, owner prod pass
  done):** board pin **AR1: A**
  — the sign-in mode-toggle and "Forgot password?" links **stack** in a new
  `.auth-links` column (the as-first-built inline layout collided them). Three
  senior-review notes applied over the spec's verbatim code: `disabled={busy}` on
  the forgot button (no double-send), the status line clears on the sign-in↔sign-up
  toggle, and the tab title is title-cased "Reset Password". `/reset-password`
  gates on **session presence** (not specifically a recovery event) — an
  authenticated user can change their password there too; not a security issue
  (`updateUser` needs a valid session). **AR2 (reset page): signed off
  2026-07-11 — owner verdict A, kept as built. Both AR pins are resolved.**
- **Optimistic UI (M10 PR 2): "everything client-writable"**, interpreted as
  a binding per-mutation table: item-level mutations get true
  apply-then-rollback optimism; `createPlan`/`savePlanMeta`/
  `deleteSelectedPlan` stay pessimistic (rare, confirm-gated); recipe save
  keeps the atomic RPC await but drops the post-save refetch chain; the C1
  `saveRecipeForm` seam is never touched.
- **Templates (M13): copy-a-previous-week at creation time**, chosen over a
  `meal_plan_templates` table — zero schema, covers the household-rotation
  use case. Out-of-range items are skipped and counted, never clamped.
- **Grocery unit merge (M12): merge within dimension** (volume↔volume,
  weight↔weight via the existing `units.unit_type`; count codes never merge),
  displayed in the largest contributing unit. Owner chose this knowing it is
  the fifth migration (full DB ritual). Conversion factors live in a new
  `units.base_factor` column (data-driven, not hardcoded in the function);
  old-key rows normalize state-intact with `bool_and` merge semantics.
- **Execution rails:** per-milestone go-ahead required. **M9 + M10 shipped
  (2026-07-05); M11 shipped (built 2026-07-06; merged + deployed + owner prod
  pass 2026-07-11, PR #37); M12–M15 remain unapproved.**
  Recommended order 12 → 13 → 14 → 15 (dependencies in
  [roadmap.md](roadmap.md)); board pins for M13/M15 may bundle into one round,
  M14 gets its own.

### Milestone 9 build decisions (2026-07-05)

M9 (Resilience) built and shipped from the locked spec
([plans/error-boundaries.md](plans/error-boundaries.md)); PR #33 (`main`
`8f1cd46`), deployed. Build-time decisions on top of the scoping verdicts above:

- **`notFound()` is tripped at render time, not from the async loader
  (deviation from spec §3e).** The spec said to call `notFound()` inside the
  async `loadRecipe`, but the Next.js docs (checked via Context7) confirm an
  async-thrown `notFound()` is not caught by the not-found boundary — it must be
  thrown during render. So the `PGRST116` "no rows" case sets a `missing` state
  flag and `notFound()` runs at render time. Same observable behavior the spec's
  §6.5 acceptance requires (proven live: `/recipes/<bad-uuid>` → not-found
  panel). The spec's intent stands; only the mechanism changed.
- **`toAuthErrorMessage` passes unmapped-but-readable messages through** (owner
  call, `/code-review` follow-up). The spec froze a generic fallback for all
  unmapped auth errors; the owner chose to pass readable messages through
  instead (rate limits, weak-password, etc.), keeping the generic line only for
  the no-message case — consistent with `toErrorMessage`'s "raw beats hidden"
  philosophy. The three friendly maps (bad credentials, unconfirmed email,
  already-registered) stay.
- **Board pin EB1 (error panel): signed off as built.** The 404 keeps a single
  "Go to Today" (no "Try again", since there is no crashed state to retry).
- **Boundary panels use a plain `<a href="/">` (not `next/link`)** so recovery
  is a full reload that also clears the crashed client state; the
  `@next/next/no-html-link-for-pages` lint rule is suppressed inline with a
  reason on each. `global-error.tsx`'s inline `style` (font + padding, no color)
  is the one sanctioned exception to the no-inline-style rule (globals.css may
  not have loaded); documented in [design-system.md](design-system.md).

### Milestone 10 PR 1 — Shop staleness UX (2026-07-05)

M10 PR 1 built and shipped from the locked spec
([plans/responsiveness.md](plans/responsiveness.md) §3); PR #34 (`main`
`41fa28b`), deployed. Builds on the "Grocery Identity and Staleness (2026-07-02)"
decision above.

- **Staleness is surfaced, never auto-resolved.** The Shop page no longer
  regenerates the grocery list on load when `groceries_version !== version`.
  Instead it renders an amber banner + explicit Generate/Update button; the list
  stays fully usable while stale and nothing writes until the button. This is the
  locked owner decision (option A in the spec) — no auto-regeneration on load,
  ever. The manual "Regenerate" ghost button stays as the escape hatch when the
  banner is absent.
- **Board pin SB1: A (amber).** The banner uses the accent-soft / accent-deep /
  accent amber treatment (as built) rather than a quiet-neutral surface-muted
  variant. Owner picked A for urgency/visibility; captured both variants in-situ
  before the call.
- **`stale` is component state reset at the top of `loadGroceryItems`** (senior
  `/code-review` fix), not derived from `selectedPlan`. Deriving it would flip
  the banner the instant `selectedPlanId` changes while `items` still holds the
  previous plan's rows (async load, no `loading` toggle) — flashing the wrong
  banner/copy on every plan switch. Resetting `setStale(false)` before the fetch
  keeps `stale`/`items` a coherent snapshot.

### Milestone 10 PR 2 — optimistic writes (2026-07-05)

M10 PR 2 built and shipped from the locked spec
([plans/responsiveness.md](plans/responsiveness.md) §4); PR #35 (`main`
`1d16ef8`), deployed. Completes milestone 10.

- **Item-level mutations are optimistic; form saves shed their refetches.**
  Grocery toggle/bucket/pantry/on-hand and plan adjustServing/removeItem/addMeal
  patch local state before the write; recipe save/delete patch the list locally
  instead of a full reload. The atomic `save_recipe` RPC await is kept (validation
  is the point), and `saveRecipeForm` (the C1 seam) was not touched. Plan
  mutations keep `refreshPlansAndKeepSelection` (version freshness) but drop the
  `loadPlanItems` item refetch.
- **Rollback is targeted and functional, not a whole-list snapshot** (senior
  `/code-review` decision — owner chose to harden over the spec's literal §4a
  snapshot pattern). On failure each function restores only the touched item's
  field (or re-inserts only the removed row at its index); a concurrent optimistic
  patch on another item is therefore never clobbered. This realizes the spec's
  locked "use functional setState everywhere; last-write-wins accepted (single
  household), no mutation queues" directive.
- **A committed write is never rolled back by a later refresh failure.** The DB
  write and the follow-up `refreshPlansAndKeepSelection` are separated by a
  `written`/`deleted` flag (or, for `addMeal`, a tempId filter that no-ops once the
  id is swapped), so only a genuine write failure reverts the UI. This fixed a
  regression the first optimistic draft introduced.
- **`addMeal` temp ids carry a random suffix** (`optimistic-${Date.now()}-${rand}`)
  so a same-millisecond double-add cannot collapse two rows onto one real id.
- No visual surface, so no board pin. Proven by `verify-optimistic-pass.mjs`
  (16/16 latency + rollback probe) plus the re-run regression harnesses.

### Cook-feedback fixes — zero-amount display convention + step boundaries (2026-07-11)

Shipped same-session from the owner's mid-cook report (PR #38, `main`
`be3fa74`).

- **`amount = 0` means "unquantified", and the display layer owns the
  translation.** The importer's convention (`"to taste"/"pinch"/"as needed" →
  amount: 0`, `lib/import/prompt.ts`) is kept as-is in the data — no sentinel
  values, no schema change. Every ingredient-amount display site renders a zero
  as **"to taste"** through the single helper `formatIngredientAmount`
  (`lib/grocery.ts`); new display surfaces must use it rather than
  `formatAmount` + unit. The editor deliberately still shows the raw `0` — it
  edits the stored value.
- **Imported steps keep the source's own boundaries.** The parser was
  atomizing steps (an NYT recipe's ~5 became 16 one-sentence steps); the STEPS
  prompt rule now forbids splitting a source step. Prompt-only, future imports
  only — already-imported recipes keep their stored steps until re-imported or
  hand-edited.
- **The accurate chips fix is deferred to candidate M16, not patched into the
  heuristic.** Real use confirmed the long-flagged `matchesStep` failure mode
  ("**medium** shallot" chips onto "medium heat"). Rather than tune word
  filtering, the fix is scoped as a step↔ingredient link captured at import
  ([plans/step-ingredients.md](plans/step-ingredients.md)) — owner forks not
  yet locked; the heuristic stays untouched as the eventual fallback.
- **Recipe deletes cascade to plan items** (`meal_plan_items.recipe_id` is
  `on delete cascade`) — recorded here because it shapes the re-import advice:
  deleting an old imported recipe removes it from current AND past plans, so
  the owner re-imports after the cooking day, or hand-edits steps to keep the
  recipe id.

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
