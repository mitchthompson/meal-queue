# Current State

Last reviewed: 2026-07-02

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**The reflow is complete and review round 1 is shipped.** Milestones 0–4,
mini-M5, and milestone 6 are done; the database layer is atomic, race-free,
and state-preserving (108 pgTAP assertions in CI), with data layers in
`lib/hooks/`. The redesign ([redesign-brief.md](redesign-brief.md)) shipped
screen by screen on 2026-07-02 (Cook PR #13, Today PR #14, Shop PR #15,
Plan PR #16), and the owner's same-day review pass produced **round 1**
(PRs #17–#18, merged 2026-07-02 afternoon): cook-step ingredients as one
quiet line, the recipe editor takes over the screen on mobile, and — the
big one — **the lunch/dinner division is gone**: Plan days are flat meal
lists, quick-add is per-day and mobile-first (44px rows, recently-planned
first), and Today's hero shows up to two meals ("Also tonight"). No schema
changes anywhere: `meal_type` survives as a vestigial column (new rows
write `'dinner'`, nothing reads it). **Next: the v2 sweep** (owner-approved
2026-07-02) — first the mechanical token-fix PR killing the hardcoded
old-palette values, then per-screen passes over Settings / Recipes library
+ editor / recipe detail ([roadmap.md](roadmap.md) milestone 7). Ten
review-board pins are still open in [design-flags.md](design-flags.md)
(C1 got its verdict; P4 was superseded by the flat-day rework).

## Stable Baseline

- **`main`:** at `17885e6` — the full reflow (PRs #13–#16) plus review
  round 1: quiet cook line + mobile recipe editor (PR #17, `ae79515`) and
  flat day lists + mobile quick-add (PR #18, `17885e6`), all deployed on
  Vercel. The owner pushed `cde7c1e` (`npm run dev:phone` LAN preview)
  directly the same day. Merge to `main` auto-deploys (confirmed); Cook was
  owner-verified on-device in prod.
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (typecheck / vitest / build)
  and DB tests (ephemeral Supabase stack, 108 pgTAP assertions across three
  suites), CLI pinned 2.109.0, NOTESTS guard. Eighteen PRs merged; every PR's
  first CI run has been green. Housekeeping flag: the workflow's
  `actions/*@v4` actions warn about deprecated Node 20 — bump versions in
  passing.
- **Latest verification:** 2026-07-02 (round 1) — typecheck clean, vitest
  16/16, `next build` green on both branches and both merge pushes; pgTAP
  108/108 in CI (the DB layer untouched again). Both round-1 branches were
  driven end-to-end with Playwright on the local stack with assertions
  (chip computed styles; editor-takeover scroll/visibility; flat-day
  rendering incl. a legacy lunch row; quick-add tap + Enter paths; the
  two-meal hero) — zero console errors.
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** None — reflow review round 1 is merged and deployed
  (PRs #17–#18, first-try green CI, no schema changes). No work in flight;
  all branches merged.
- **Next action:** **the v2 sweep, part 1** (owner-approved 2026-07-02):
  branch `codex/v2-token-sweep` off `main`, replace every hardcoded
  old-palette value in `app/globals.css` with token-set-v2 variables — the
  exact offenders are listed in the "Pre-reflow remnants" flag in
  [design-flags.md](design-flags.md) (the ≤700px `.panel` cream override is
  the high-impact one; also `.recipe-view-section`, `.recipe-meta`,
  `.recipe-step-item`, `.pantry-badge`, stray `#fff` literals). Mechanical
  swap, no layout changes; verify by driving Settings, Recipes list/editor,
  and recipe detail on the local stack at 390px. Then **part 2**: per-screen
  v2 passes (Settings → Recipes library/editor → recipe detail) in the
  reflow rhythm — see [roadmap.md](roadmap.md) milestone 7. After the sweep:
  the 10 open review-board pins, then the standing follow-ups
  (settings-defaults single source of truth, ESLint config + CI lint step,
  npm audit triage — 1 high root, 9 in `mcp/` — and the Actions Node-20
  version bump).
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
| Today | `/` (`app/page.tsx`) | Working — reflow home screen ("Tonight" hero shows up to two meals + "Also tonight", deadline strip, week peek without meal-type sublabels, nudge); data layer in `lib/hooks/use-today.ts` |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; atomic `save_recipe` RPC live; on mobile the editor takes over the screen ("‹ Back to recipes", PR #17); data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working; "Start cooking" launches the reflow's full-screen Cook mode (`components/cook-mode.tsx`); still carries pre-v2 cream values — v2 sweep target |
| Plan | `/plans` (`app/plans/page.tsx`) | Working — flat day lists (no lunch/dinner division, PR #18; `meal_type` vestigial), per-day quick-add (44px rows, recents first), sheets, generate exit; day items in `components/plan-day-items.tsx`; data layer in `lib/hooks/use-plan.ts` |
| Shop | `/grocery` (`app/grocery/page.tsx`) | Working — reflow chunky direction (pinned order bar, 30px checks, sticky sections); transactional state-preserving regeneration underneath; data layer in `lib/hooks/use-grocery-list.ts` |
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
| — | The Reflow (redesign) | Done (2026-07-02) — Cook (PR #13), Today (PR #14), Shop (PR #15), Plan (PR #16); token set v2 live app-wide ([redesign-brief.md](redesign-brief.md)) |
| — | Reflow review round 1 | **Done (2026-07-02)** — quiet cook line + mobile recipe editor (PR #17); flat day lists, mobile quick-add, two-meal hero (PR #18); 10 board pins still open |
| 7 | V2 Sweep | **Next** — token-fix PR first, then per-screen passes (Settings → Recipes → recipe detail); owner-approved 2026-07-02 ([roadmap.md](roadmap.md)) |

## Architecture snapshot

- Next.js 15 App Router + React 19 on Vercel; client components query Supabase
  directly (owner-based RLS, explicit Data API grants), with per-page data
  layers extracted to `lib/hooks/` (grocery, plans, recipes, today) and the
  Plan day presentation in `components/plan-day-items.tsx` (formerly
  `plan-slot-cell.tsx`; renamed with the flat-day rework, PR #18).
- Aggregate writes are **database transactions**: `save_recipe`,
  `regenerate_grocery_list`, and plan-integrity triggers (scoped version
  bumps, cross-row validation with row locks). The browser no longer
  orchestrates multi-request writes.
- Plain CSS design-token system in `app/globals.css` (no Tailwind);
  `lib/design-tokens.ts` mirrors the few values TS needs (manifest, viewport).
- Tests: vitest for `lib/` domain logic (16); pgTAP for the database layer
  (108 across three suites) on an ephemeral local/CI stack.
- `supabase/schema.sql` canonical; forward-only migrations in
  `supabase/migrations/`; prod applies by hand (runbook: backup → preflight →
  apply → verify → rolled-back smoke), **migration before dependent client
  merge**.

## Open issues

- Pre-reflow remnants: hardcoded old-palette values in `app/globals.css`
  (mobile `.panel` cream, recipe detail, pantry badge) and un-swept screens
  (Settings, Recipes library/editor, recipe detail) — the v2 sweep is the
  approved next action ([design-flags.md](design-flags.md)).
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
