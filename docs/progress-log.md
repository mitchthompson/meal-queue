# Progress Log

This is an append-only, decision-rich log. Add the newest entry at the top.
Include outcomes, important tradeoffs, verification, and remaining work.

## 2026-07-01 - Milestone 2 Merged; CI Failure Root-Caused and Fixed; Tooling

- **Milestone 2 landed on `main`.** The MCP `save-recipe` tool was cut over to
  the `save_recipe` RPC (adversarially verified), prod was confirmed Postgres
  **17.6** and `config.toml` aligned to 17, the branch was pushed, and the owner
  merged PR #2. **Merging deployed production on Vercel** — which resolved the
  long-open deploy-trigger flag by observation (auto-deploy on `main`, previews
  on branches) but also shipped the RPC client ahead of its database function,
  leaving prod recipe-saves broken until the migration is applied (the owner is
  applying it with a `pg_dump` backup taken first). Lesson recorded: apply
  migrations before merging dependent client code — merge = release.
- **First CI run: app-checks green; db-tests (pgTAP) red.** Root cause found by
  a multi-agent diagnosis, then **reproduced locally**: the Supabase CLI's
  `auto_expose_new_tables` default flip (2026-05-30) means fresh stacks no
  longer grant `anon`/`authenticated`/`service_role` the legacy implicit table
  privileges — and the schema never declared any. Test 1 died with
  `42501: permission denied for table recipes` and the single-transaction suite
  cascaded. Prod is unaffected (predates the flip, keeps its grants).
- **Fix (owner-approved) on `codex/ci-grants-fix`:** migration
  `20260701220327_data_api_grants.sql` making the Data API grants explicit
  (no-op on prod; documents existing reality), mirrored in `schema.sql`,
  baseline regenerated. `ci.yml` hardened: CLI pinned to 2.109.0, unneeded
  services excluded from `supabase start` (faster, and works around a
  Colima-specific `vector` docker.sock mount bug locally), and a **NOTESTS
  guard** (pg_prove exits 0 on zero discovered tests — a broken glob would
  otherwise read as green).
- **Verification:** full-fidelity local rehearsal — `supabase db reset` (fresh
  DB purely from migrations) + `supabase test db` → **33/33 pass**. Also
  verified the failure mode first (without grants: identical to CI), so the fix
  is causally proven, not coincidental.
- **Tooling installed** (owner-approved): GitHub CLI 2.95, Colima 0.10 + docker
  client, Supabase CLI 2.109 (binary install — note: v2.109 ships `supabase` +
  `supabase-go` as co-located binaries; brew tap was blocked by outdated Xcode
  CLT), libpq 18.4 (`pg_dump`/`psql` for PG17 prod). The local Supabase stack
  now runs on Colima — the "no local Docker" constraint is retired.
- **Repo-local git identity** set to the `mitchthompson` GitHub account
  (noreply email) so commits link to the profile; other projects unaffected.
- **Gotchas recorded:** background shell commands can lose cwd (the nested
  `meal-queue/meal-queue` layout makes the CLI silently boot a default,
  config-less stack from the outer dir — symptom: project named `meal-queue`
  instead of `meal-queue-local`, `NOTESTS`); CLI 2.109 renamed excludable
  services (`vector,logflare,mailpit,supavisor,...`).
- **Remaining:** owner finishes backup + applies the `save_recipe` migration +
  `gh auth login`; push `codex/ci-grants-fix` → PR → first green db-tests run;
  then milestones 3–4.

## 2026-06-27 - Milestone 2 Implemented (on branch) + CI/Test Harness Foundation

Worked on `codex/atomic-recipe-saves`. **Nothing committed or pushed; no prod
database change applied.** Both the Milestone 2 code and a new CI/test-harness
foundation are staged in the working tree for review.

- **Setup / baseline.** Installed dependencies with `npm ci` (repo had no
  `node_modules`). Confirmed the project lives one level below the shell cwd at
  `meal-queue/meal-queue`. `npm run test` 13/13 pass. `npm run typecheck` was red
  only because the root `tsconfig` globbed the separate `mcp/` package (deps not
  installed) — fixed by excluding `mcp` from the web-app tsconfig (matches the
  documented MCP boundary); typecheck is now clean. `npm run lint` is
  **non-functional** (no ESLint config; `next lint` is deprecated and opens an
  interactive wizard) — flagged. `npm ci` reports **1 high-severity vuln**
  (docs previously said zero) — flagged, untouched.
- **Milestone 2 — Atomic Recipe Saves (code complete, not applied).** Added
  `supabase/migrations/20260627222320_atomic_recipe_save.sql`: a
  `save_recipe(...)` Postgres function (security invoker, `search_path` pinned)
  that upserts the recipe parent and replaces ingredients/steps/tags in one
  transaction — any failed child rolls back the whole save. On an update whose
  ingredient identity set changed, it bumps `meal_plans.version` for the owner's
  referencing plans, so grocery lists (`source_key` carries `v<version>|`) are
  detected stale and regenerate. Reflected byte-identically in `schema.sql`.
  Switched the client save (`app/recipes/page.tsx`) to a single
  `supabase.rpc("save_recipe", …)`. Reviewed adversarially across six lenses
  (no code defects); applied hardenings: owner-scoped the version-bump UPDATE,
  corrected a misleading comment, appended `notify pgrst, 'reload schema';`, and
  added an APPLY ORDER note. Confirmed the live-DB assumptions via the prior
  project agent: RLS enabled + policies match `schema.sql`; no relevant schema
  drift; `authenticated` holds table DML grants; no pre-existing `save_recipe`;
  a current plan with cook items exists for acceptance testing. Vercel deploy
  trigger and Supabase email-confirmation remain unconfirmed.
- **Milestone 1.5 — CI + Test Harness (new milestone, scaffolded, not run).**
  Owner chose to build a testing foundation before applying reliability
  migrations to prod ("plan B"), since there is no staging. Free approach:
  `pg_dump`/`supabase db dump` for backups (Pro-tier PITR not needed); an
  ephemeral local Supabase stack as "staging" (CI uses GitHub runners' Docker,
  so no local Docker is required). Scaffolded `.github/workflows/ci.yml`
  (app-checks: `npm ci`/typecheck/test/build with placeholder `NEXT_PUBLIC_*`
  env, no lint; db-tests: `supabase start` → `supabase test db`, no cloud
  credentials), `supabase/config.toml`, `supabase/seed.sql`, and
  `supabase/tests/save_recipe_test.sql` (33 pgTAP assertions: happy-path
  normalization, wholesale child replacement, atomicity rollback on FK/check
  violations, version-bump vs no-op, RLS/owner-scope on the app and service-role
  paths). Resolved the "prod predates migrations" wrinkle with a CI/local-only
  baseline `20260101000000_baseline_schema.sql` (regenerable byte-identical copy
  of `schema.sql`, sorts first) so a fresh CI DB builds the schema before the
  function validates under `check_function_bodies`. Verified locally as far as
  possible without Docker: typecheck clean, 13/13 tests, `next build` green with
  placeholder env (red without), baseline byte-identical to `schema.sql`. The
  db-tests job itself has not run — first real proof is the CI run.
- **Key decisions.** Diff-based version bump (only when the ingredient set
  changes) over always-bump. MCP `save-recipe` cutover to the RPC deferred to a
  follow-up commit on the same branch (needs `cd mcp && npm ci`). Introduce the
  Supabase CLI for local/CI testing only; prod stays hand-applied via the SQL
  editor. CI/local-only baseline supersedes the "no synthetic baseline
  migration" rule for the local/CI path only (recorded in
  [decisions.md](decisions.md) and `supabase/migrations/README.md`).
- **Flags raised.** `npm run lint` non-functional; `config.toml`
  `major_version = 15` unconfirmed vs prod (CLI default is now 17 — confirm with
  `SHOW server_version;`); 1 high-severity `npm audit` finding. See
  [design-flags.md](design-flags.md).
- **Next steps.** (1) Owner sign-off on the CI/local-only baseline decision;
  (2) confirm prod's Postgres major version and align `config.toml`; (3) commit
  the branch, push, open a PR to `main` to run CI; (4) on green CI, apply the
  `save_recipe` migration in the Supabase SQL editor, then acceptance-test;
  (5) MCP `save-recipe` cutover; (6) resume Milestones 3–4. Optional: read-only
  Supabase MCP for verification, pin the CLI version, configure ESLint, add a
  baseline-vs-`schema.sql` CI diff guard.

## 2026-06-19 - Documentation System Migration

- Migrated the project documentation to a lowercase-kebab canonical system and
  rewrote internal links to the new filenames: `product.md`, `architecture.md`
  (now absorbs deploy/setup/migration/rollback content), `qa.md` (verification
  and acceptance/QA per change type), `current-state.md`, `progress-log.md`
  (this file, formerly `HISTORY.md`), `decisions.md`, `roadmap.md`, and the
  rewritten `README.md` index.
- Added a `/CLAUDE.md` anchor at the repo root as the operating contract for
  agents; the end-of-session checklist is now canonical there and in `qa.md`.
- Created net-new docs with no prior equivalent:
  [design-system.md](design-system.md), [design-flags.md](design-flags.md),
  [routes.md](routes.md), [data-model.md](data-model.md), and the per-page
  intent docs under [pages/](pages/) (dashboard, recipes, plans, grocery,
  settings).
- Key decision: the design source of truth is in-repo and authoritative —
  data truth in `supabase/schema.sql` (derived in [data-model.md](data-model.md)),
  UI truth in the CSS-variable tokens of `app/globals.css` (documented in
  [design-system.md](design-system.md)), and per-page intent in `pages/<slug>.md`.
  No CSS class prefix is used: the token system in `app/globals.css` is the
  namespace, so design values flow through `--color-*`/semantic aliases and are
  never hardcoded.
- Flag raised: confirm the Vercel deploy trigger (assumed auto-deploy on push to
  `main`, unconfirmed) — see [design-flags.md](design-flags.md).
- The dated artifacts `docs/CODE_AUDIT_2026-06-11.md` and
  `docs/UI_AUDIT_2026-06-11.md` are unchanged.

## 2026-06-11 - Front-End UI Audit and Milestone 5

- Audited all five screens for layout, responsiveness, accessibility, and
  interaction flows; visually verified the unauthenticated screens at desktop
  and iPhone viewports. Full findings: [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md).
- Top friction: feedback messages render off-screen with no `aria-live`,
  text-button tap targets are below iOS guidance, the mobile recipe editor
  opens without scrolling into view, the plans page buries the week grid, and
  every navigation shows a loading flash with no cached data.
- Owner decisions: feedback overhaul, mobile ergonomics, and loading polish
  become roadmap milestone 5 (after the reliability core, before component
  hardening, which is now milestone 6); accessibility fixes fold into each
  track; auth flow completion is deferred.
- Next work: milestone 2 (atomic recipe saves).

## 2026-06-11 - Reliability Foundation and Audit Merged

- Merged `codex/reliability-foundation` (`7cfbab2`) and
  `codex/code-audit-plan` (`e13f158`) into `main`.
- GitHub CLI is unavailable, so with the owner's approval the reviewed
  branches were merged locally with merge commits instead of web pull
  requests. The audit itself served as the review of the reliability
  foundation diff.
- Verification on merged `main`: `npm run test` (13 passing),
  `npm run typecheck`, and `npm run build` passed.
- Next work: detailed front-end UI audit (owner request), then milestone 2.

## 2026-06-11 - Independent Code Audit and Plan Confirmation

- Audited all application source, the Supabase schema, tests, and the prior
  reliability review. Full findings: [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md).
- Confirmed all six previously documented reliability risks as accurate and
  the milestone 2-5 targeting as sound.
- New findings: silent over-triggered grocery regeneration compounds the
  checklist wipe, the dashboard's 4-plan window can hide the current week,
  duplicate settings initialization, and the `mcp/` server was entirely
  untracked.
- Owner decisions: scope is milestones 2-4 in roadmap order, implemented with
  Postgres functions and triggers; remaining findings deferred and recorded in
  [roadmap.md](roadmap.md); `mcp/` source brought under version control.
- Verification: `npm run test` (13 passing) and `npm run typecheck` passed.
- Remaining work: merge `codex/reliability-foundation` and
  `codex/code-audit-plan`, then start milestone 2.

## 2026-06-09 - Reliability Foundation Implemented

- Added Vitest with 13 tests covering local date arithmetic, plan defaults,
  ingredient scaling, grocery normalization, exact-match grouping, pantry
  separation, source keys, and rounding.
- Extracted shared domain logic into `lib/date-utils.ts` and `lib/grocery.ts`
  without changing route interfaces.
- Corrected date serialization to use local calendar fields instead of UTC,
  preventing timezone-driven off-by-one dates.
- Established `supabase/migrations/` as a forward-only migration directory
  without creating a false baseline for the live database.
- Upgraded Next.js from `15.2.6` to patched release `15.5.19` and added targeted
  PostCSS and `ws` overrides. `npm audit` reports zero vulnerabilities.
- Verification: `npm run test`, `npm run typecheck`, `npm run build`, internal
  Markdown links, and `git diff --check` passed.
- Remaining work: review, commit, push, and merge the reliability foundation
  branch before starting atomic recipe saves.

## 2026-06-07 - Hybrid Git and Session-Wrap Workflow

- Merged the documentation foundation through PR #1 at commit `0108c44`.
- Decided that pull requests are used for risk management rather than required
  for every change.
- Database migrations, broad refactors, and risky behavior changes retain a
  pull-request review gate.
- Small, low-risk, and documentation-only changes may be committed directly to
  `main` after verification.
- Added a required end-of-session wrap covering Git state, verification,
  current-state handoff, documentation updates, incomplete work, and the exact
  next action.
- Next work: begin the reliability foundation milestone.

## 2026-06-07 - Documentation Foundation Started

- Reviewed the repository, current application flows, Supabase schema, and
  existing project documents.
- Verified local and GitHub `main` both pointed to commit `022e354`.
- Chose a reliability-first roadmap for a personal/household product.
- Chose small reviewed pull requests and additive migrations that preserve live
  Supabase data.
- Established the project-memory documentation structure.
- Verification: internal Markdown links, `git diff --check`,
  `npm run typecheck`, and `npm run build` passed.
- Result: merged through PR #1 at commit `0108c44`.

## 2026-02-15 - Mobile UI Optimization

- Commit: `022e354`.
- Improved mobile navigation and responsive application layouts.
- This is the current baseline for the reliability roadmap.

## 2026-02-14 - Next.js Security Patch

- Commit: `978168c`.
- Updated Next.js in response to CVE-2025-66478.

## 2026-02-14 - Core Workflow Improvements

- Commit: `b3bb3d9`.
- Improved meal-plan, grocery, and recipe UI flows.

## 2026-02-14 - Initial Application

- Commits: `68cc532`, `919b10a`, and earlier repository initialization.
- Established the Next.js and Supabase application with recipes, planning,
  grocery lists, settings, authentication, and row-level security.
