# Current State

Last reviewed: 2026-07-02

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**The reflow is underway — Cook and Today are live.** Milestones 0–4, mini-M5,
and milestone 6 are shipped; the database layer is atomic, race-free, and
state-preserving (108 pgTAP assertions in CI), and the heavy route components
sit on extracted data layers in `lib/hooks/`. On that foundation the approved
redesign ([redesign-brief.md](redesign-brief.md)) is shipping screen by
screen: **Cook mode** (PR #13, full-screen dark takeover) and **Today** (the
new home screen replacing the dashboard, `lib/hooks/use-today.ts`), which
carried **token set v2 app-wide** — paper/teal/amber palette, native system
type, 4-tab reflow navigation. Release rails for the remaining screens are
owner-pre-approved ([decisions.md](decisions.md), Reflow Release Rails).
**Next screen: Shop.** Existing household data is live and must stay
compatible throughout. See [roadmap.md](roadmap.md).

## Stable Baseline

- **`main`:** reflow screen 1 (Cook mode) merged (PR #13, `50dd5ac`,
  2026-07-02) and deployed on Vercel (merge to `main` auto-deploys —
  confirmed; this deploy verified by the owner on-device).
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (typecheck / vitest / build)
  and DB tests (ephemeral Supabase stack, 108 pgTAP assertions across three
  suites), CLI pinned 2.109.0, NOTESTS guard. Thirteen PRs merged; every PR's
  first CI run has been green (latest: app checks 43s, db tests 1m03s).
  Housekeeping flag: the workflow's `actions/*@v4` actions warn about
  deprecated Node 20 — bump versions in passing.
- **Latest verification:** 2026-07-02 — typecheck clean, vitest 15/15,
  `next build` green (11 routes); pgTAP 108/108 in CI (PR #13 — the DB layer
  was untouched); Cook mode additionally driven end-to-end (Playwright on the
  local stack, plus the owner's first on-device pass in prod — positive; chip
  quality on real recipes still to be judged over time, see the flag).
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** The reflow, screen by screen (order: Cook, Today, Shop,
  Plan) under owner-pre-approved release rails ([decisions.md](decisions.md)).
  **Cook (PR #13) and Today (`codex/reflow-today`) are shipped**; Today also
  carried token set v2 app-wide (palette, native type, 4-tab navigation) and
  resolved the dashboard empty-current-week flag at the root. Open flags from
  these screens ([design-flags.md](design-flags.md)): Cook chips heuristic,
  mark-cooked no-op (decide with Today's data needs), settings-gear
  placement, plan-less Today styling, amber link-hover, desktop column width.
  Mockups: [mockups/reflow-v1.html](mockups/reflow-v1.html).
- **Next action:** **Shop** (reflow screen 3) on a fresh `codex/reflow-shop`
  branch cut from `main`: restyle `/grocery` per the mockup's chunky
  direction over the existing `lib/hooks/use-grocery-list.ts` — pinned
  dark order/pickup bar with live unchecked count, 30px checkboxes,
  "Groceries" vs "Pantry check" sections, checked = teal fill +
  strikethrough. Answer with the owner while building: keep the manual
  "Regenerate" button or trust staleness (the brief's open question), and
  what happens to the on-hand bucket in the new layout. Verify with
  typecheck / vitest / build (+ drive it), then PR → green CI → merge
  (pre-approved).
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
| — | The Reflow (redesign) | **In progress** — Cook (PR #13) and Today shipped, token set v2 live app-wide; next: Shop, then Plan ([redesign-brief.md](redesign-brief.md)) |

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
