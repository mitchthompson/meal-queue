# Current State

Last reviewed: 2026-07-02

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**The reflow is complete — all four screens live.** Milestones 0–4, mini-M5,
and milestone 6 are shipped; the database layer is atomic, race-free, and
state-preserving (108 pgTAP assertions in CI), with data layers in
`lib/hooks/`. The approved redesign ([redesign-brief.md](redesign-brief.md))
shipped screen by screen on 2026-07-02: **Cook mode** (PR #13, dark
takeover + wake-lock), **Today** (PR #14, home screen + token set v2
app-wide + 4-tab navigation), **Shop** (PR #15, pinned order bar + chunky
checks), and **Plan** (day rows + quick-add + sheets; killed the nth-child
label coupling). The app now runs the household's real weekly cycle:
Plan → Shop → Cook, with Today as the hub. **Next: the owner reviews the
flagged reflow defaults in [design-flags.md](design-flags.md)**, then the
deferred follow-ups (settings-defaults single source of truth, ESLint, npm
audit, Actions version bump). Existing household data stayed compatible
throughout — no schema changes in the entire reflow. See
[roadmap.md](roadmap.md).

## Stable Baseline

- **`main`:** the full reflow merged and deployed on Vercel — Cook (PR #13,
  `50dd5ac`), Today + token set v2 (PR #14, `15501f2`), Shop (PR #15,
  `73ee3f5`), Plan (PR #16). Merge to `main` auto-deploys (confirmed); Cook
  was owner-verified on-device in prod.
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (typecheck / vitest / build)
  and DB tests (ephemeral Supabase stack, 108 pgTAP assertions across three
  suites), CLI pinned 2.109.0, NOTESTS guard. Sixteen PRs merged; every PR's
  first CI run has been green. Housekeeping flag: the workflow's
  `actions/*@v4` actions warn about deprecated Node 20 — bump versions in
  passing.
- **Latest verification:** 2026-07-02 — typecheck clean, vitest 16/16,
  `next build` green (11 routes); pgTAP 108/108 in CI (the DB layer was
  untouched by the entire reflow). Every reflow screen was additionally
  driven end-to-end with Playwright on the local stack (fresh user → sample
  data → plan → generate → shop → cook), and the final drive exercised the
  whole weekly cycle across the four new screens with zero console errors.
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** None — **the reflow is complete** (Cook PR #13, Today
  PR #14, Shop PR #15, Plan `codex/reflow-plan`; all first-try green CI, no
  schema changes). No work in flight; all branches merged.
- **Next action:** owner review pass on the reflow's flagged defaults
  ([design-flags.md](design-flags.md)): Cook chips heuristic + mark-cooked
  no-op (pairs with any future "cooked" state), Today's settings-gear /
  plan-less / amber-hover / column-width, Shop's kept-Regenerate +
  collapsed-On-hand, Plan's sheets / generate-as-link / filters. Then pick
  up the standing follow-ups: settings-defaults single source of truth
  (owner-split from M6), ESLint config + CI lint step, npm audit triage
  (1 high root, 9 in `mcp/`), GitHub Actions version bump (Node 20
  deprecation warnings).
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
| Today | `/` (`app/page.tsx`) | Working — reflow home screen (tonight hero → Cook mode, deadline strip, week peek, nudge); data layer in `lib/hooks/use-today.ts`; the old dashboard's 4-newest-plans bug is fixed |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; atomic `save_recipe` RPC live; data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working; "Start cooking" launches the reflow's full-screen Cook mode (`components/cook-mode.tsx`, shipped PR #13) |
| Plan | `/plans` (`app/plans/page.tsx`) | Working — reflow day rows (quick-add primary, today highlight, sheets, generate exit); nth-child label coupling removed; DB-enforced integrity underneath; data layer in `lib/hooks/use-plan.ts` |
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
| — | The Reflow (redesign) | **Done (2026-07-02)** — Cook (PR #13), Today (PR #14), Shop (PR #15), Plan; token set v2 live app-wide; flagged defaults awaiting owner review ([redesign-brief.md](redesign-brief.md)) |

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
