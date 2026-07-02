# Current State

Last reviewed: 2026-07-02

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**Reliability core + component hardening complete → the reflow.** Milestones
0–4, mini-M5, and milestone 6 are shipped and live. The database layer is
atomic, race-free, and state-preserving, proven by 108 pgTAP assertions in CI
plus rolled-back live smoke tests at each prod apply; the three heavy route
components (recipes, plans, grocery) now sit on extracted data layers in
`lib/hooks/` with shared presentation where markup was duplicated. **Next up
is the approved redesign** ([redesign-brief.md](redesign-brief.md)): a reflow
around the household's weekly cycle (Plan → Shop → Cook, with a Today home
screen and a full-screen dark cooking mode), on a calm-utility look with bold
treatment where hands are busy, built screen by screen over the stable data
layer. Existing household data is live and must stay compatible throughout.
See [roadmap.md](roadmap.md).

## Stable Baseline

- **`main`:** M6 slice 4 merged (PR #12, `3409fd9`, 2026-07-02) and deployed
  on Vercel (merge to `main` auto-deploys — confirmed).
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (typecheck / vitest / build)
  and DB tests (ephemeral Supabase stack, 108 pgTAP assertions across three
  suites), CLI pinned 2.109.0, NOTESTS guard. Twelve PRs merged; every PR's
  first CI run has been green (latest: app checks 42s, db tests 1m03s).
- **Latest verification:** 2026-07-02 — typecheck clean, vitest 15/15,
  `next build` green (11 routes); pgTAP 108/108 in CI (PR #12 — the DB
  layer was untouched this session).
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** None — **milestone 6 is complete**: slices 1–4 merged and
  live (shared date formatters PR #7, `useGroceryList` PR #9, `usePlan`
  PR #10, `useRecipes` + shared `PlanSlotCell` PR #12; recipes page
  859 → 359 lines, plans page 571 → 266). **No work in flight; all branches
  merged.** Settings-defaults single source of truth was split out of M6 as
  its own follow-up (owner decision, 2026-07-02 —
  [design-flags.md](design-flags.md)). The redesign brief is
  [redesign-brief.md](redesign-brief.md); the approved direction mockups are
  in-repo at [mockups/reflow-v1.html](mockups/reflow-v1.html).
- **Next action:** start the reflow with **Cook mode** (the brief's suggested
  order is Cook, Today, Shop, Plan — confirm Cook-first with the owner at
  onboard), on a fresh `codex/reflow-cook` branch cut from `main`: build the
  full-screen dark cooking takeover per the Cook section of
  [redesign-brief.md](redesign-brief.md) and the mockup
  ([mockups/reflow-v1.html](mockups/reflow-v1.html)), launched from the
  recipe detail page — `app/recipes/[id]/page.tsx`, whose focus mode is the
  seed. In scope per the brief: step N of M in very large type, that step's
  ingredient chips, amber progress dots, giant Next / smaller Back, screen
  wake-lock while active, "Done — mark cooked" on the last step, and the
  token-set-v2 `--color-*` additions to `app/globals.css` (the first reflow
  screen carries the tokens; same token system, no hardcoded values). The
  brief's open questions for Cook (per-step timers, and any data write behind
  "mark cooked") get answered with the owner as the screen is built. Verify
  with typecheck / vitest / build, then PR → green CI → owner merge.
- **Blockers:** None.
- **Environment notes:** `.env.local` exists (prod DB access verified,
  PG 17.6); read-only Supabase MCP configured in `.mcp.json` (owner OAuth
  pending first use); `gh` holds both accounts (`2a-webteam` active machine-
  wide, `mitchthompson` pinned per command via
  `GH_TOKEN=$(gh auth token --user mitchthompson)`); local Supabase stack runs
  on Colima (`supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`).

## Page status

Routes confirmed against `app/`. Per-page intent lives in `docs/pages/<slug>.md`
(stubs; the redesign brief supersedes them for future-state intent).

| Page | Route | Status |
| --- | --- | --- |
| Dashboard | `/` (`app/page.tsx`) | Working; known issue — loads items for only the 4 newest plans; slated to become **Today** in the reflow |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; atomic `save_recipe` RPC live; data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working; focus mode is the seed of the reflow's Cook mode |
| Plans | `/plans` (`app/plans/page.tsx`) | Working; DB-enforced integrity, trigger-based scoped versioning; data layer in `lib/hooks/use-plan.ts`; shared slot cells in `components/plan-slot-cell.tsx` |
| Grocery | `/grocery` (`app/grocery/page.tsx`) | Working; transactional state-preserving regeneration (checked/on-hand/pantry-override survive); data layer in `lib/hooks/use-grocery-list.ts` |
| Settings | `/settings` (`app/settings/page.tsx`) | Working; `ensureUserSettings` runs once per sign-in (defaults duplication still open) |

Authentication is email/password through Supabase. The app installs to the
iPhone home screen as a standalone app (manifest + icons + safe-area handling,
mini-M5).

## Milestone status

| # | Milestone | Status |
| --- | --- | --- |
| 0 | Documentation Foundation | Done (PR #1, `0108c44`) |
| 1 | Reliability Foundation | Done (`7cfbab2`, 2026-06-11) |
| 1.5 | CI + Test Harness | Done (PR #3, `240b508`, 2026-07-01) |
| 2 | Atomic Recipe Saves | Done (PR #2 + prod apply, 2026-07-01) |
| 3 | Plan Integrity | Done (PR #4 + prod apply, 2026-07-02) |
| 4 | Grocery State Preservation | Done (PR #5 + prod apply, 2026-07-02) |
| 5 | UI Feedback and Ergonomics | Rescoped — mini-M5 done (PR #6, 2026-07-02); rest folds into the redesign |
| 6 | Component Hardening | Done — slices 1–4 (PRs #7, #9, #10, #12); settings-defaults split out as a standalone follow-up |
| — | The Reflow (redesign) | **Next** — briefed ([redesign-brief.md](redesign-brief.md)); start with Cook mode (suggested order: Cook, Today, Shop, Plan) |

## Architecture snapshot

- Next.js 15 App Router + React 19 on Vercel; client components query Supabase
  directly (owner-based RLS, explicit Data API grants), with per-page data
  layers extracted to `lib/hooks/` (grocery, plans, recipes) and shared
  presentation where markup was duplicated (`components/plan-slot-cell.tsx`).
- Aggregate writes are **database transactions**: `save_recipe`,
  `regenerate_grocery_list`, and plan-integrity triggers (scoped version
  bumps, cross-row validation with row locks). The browser no longer
  orchestrates multi-request writes.
- Plain CSS design-token system in `app/globals.css` (no Tailwind);
  `lib/design-tokens.ts` mirrors the few values TS needs (manifest, viewport).
- Tests: vitest for `lib/` domain logic (15); pgTAP for the database layer
  (108 across three suites) on an ephemeral local/CI stack.
- `supabase/schema.sql` canonical; forward-only migrations in
  `supabase/migrations/`; prod applies by hand (runbook: backup → preflight →
  apply → verify → rolled-back smoke), **migration before dependent client
  merge**.

## Open issues

- Dashboard loads items for only the 4 newest plans (fix lands with Today in
  the reflow).
- Default settings values duplicated across client files vs SQL defaults
  (standalone follow-up — split out of M6 by owner decision, 2026-07-02).
- No route-level `error.tsx` / `loading.tsx` boundaries; unmapped errors still
  surface raw messages (mini-M5 added friendly mapping + `aria-live`).
- `npm run lint` non-functional (no ESLint config) — tracked follow-up.
- `npm audit`: 1 high-severity finding (root), 9 in `mcp/` — triage pending.
- Full register: [design-flags.md](design-flags.md).

## Where to go next

- Redesign intent — [redesign-brief.md](redesign-brief.md)
- Milestones and deferred work — [roadmap.md](roadmap.md)
- Verification and runbooks — [qa.md](qa.md), [architecture.md](architecture.md)
- Data model — [data-model.md](data-model.md) (canonical: `supabase/schema.sql`)
- Decisions and history — [decisions.md](decisions.md), [progress-log.md](progress-log.md)
