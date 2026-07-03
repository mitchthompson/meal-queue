# Current State

Last reviewed: 2026-07-03 (ESLint/CI lint gate live — PR #23)

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**The reflow and the v2 sweep (milestone 7) are both complete.**
Milestones 0–4, mini-M5, milestone 6, and milestone 7 are done; the
database layer is atomic, race-free, and state-preserving (108 pgTAP
assertions in CI), with data layers in `lib/hooks/`. The redesign
([redesign-brief.md](redesign-brief.md)) shipped screen by screen on
2026-07-02 (Cook PR #13, Today PR #14, Shop PR #15, Plan PR #16), review
round 1 (PRs #17–#18) landed the same day, and the **v2 sweep shipped in
four PRs, all 2026-07-02**: **PR #19** (token fix — hex grep hits `:root`
only), **PR #20** (Settings, round-2 verdicts), **PR #21** (Recipes
library + editor, round-3 verdicts: A cards without the serves line,
header language + teal links, sample-data seeder removed outright, stacked
editor, full-width save — plus a fix for the save confirmation that had
never displayed), and **PR #22** (recipe detail, round-4 verdicts: flat
hairline rows both lists, full-width Start cooking, header language +
44px stepper, the pantry-badge cascade quirk fixed at the root, and the
RD5 tighter title row — breadcrumb + one-row actions). Since then the
**ESLint/CI lint gate follow-up shipped (PR #23, 2026-07-03)** — `npm run
lint` works again on a flat config and CI enforces it. **Next: the ten open
round-1 review-board pins and/or the remaining standing follow-ups** (owner
picks; see Active Handoff). The round-2/3/4 pins are all resolved and
shipped.

## Stable Baseline

- **`main`:** at `83d0b86` — the full reflow (PRs #13–#16), review round 1
  (PRs #17–#18), the complete v2 sweep (PRs #19–#22, merge `74da4ea`), and
  the **ESLint/CI lint gate (PR #23, merge `83d0b86`)**, all deployed on
  Vercel. Merge to `main` auto-deploys (confirmed); Cook was owner-verified
  on-device in prod.
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (**lint** / typecheck /
  vitest / build) and DB tests (ephemeral Supabase stack, 108 pgTAP assertions
  across three suites), CLI pinned 2.109.0, NOTESTS guard. Lint runs
  `eslint . --max-warnings=0` on the flat config (PR #23); `next build` no
  longer lints (`eslint.ignoreDuringBuilds`). Twenty-three PRs merged; every
  PR's first CI run has been green. Housekeeping flag (now confirmed live in
  run annotations): `actions/checkout@v4` / `setup-node@v4` /
  `supabase/setup-cli@v1` are force-run on Node 24 — bump `@v4 → @v5` in
  passing.
- **Latest verification:** 2026-07-03 (ESLint/CI gate, PR #23) — `eslint .`
  clean at zero warnings, typecheck clean, vitest 16/16, `next build` green
  (11/11 static pages, lint skipped); CI green on the PR (app-checks 47s,
  db-tests 1m7s) and on `main` post-merge (49s / 1m12s), pgTAP 108/108 (DB
  layer untouched). Prior (v2 sweep, 2026-07-02): both branches driven with
  Playwright on the local stack — PR #21 22/22 assertions + a live
  `save_recipe` round-trip; PR #22 15/15 + stepper / Start-cooking / `?cook=1`
  behavior checks, zero console errors.
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** None — milestone 7 complete (PRs #19–#22) and the ESLint/CI
  lint gate shipped (PR #23, merged `83d0b86`, deployed); all branches merged,
  tree clean.
- **Next action:** **owner picks the next unit** from two queues. (a) The
  **ten open round-1 board pins** in [design-flags.md](design-flags.md) —
  T1–T4 (settings gear placement, plan-less Today, amber link hover, 640px
  desktop column), P1–P3 (inline sheets, generate-is-a-link, filter pills),
  S1–S2 (Regenerate button, On-hand collapsed), C2 ("mark cooked" writes
  nothing — a schema question) — these are shipped defaults awaiting
  sign-off, so the move is to ask the owner for verdicts (pin codes in
  chat), not to build. (b) The **standing follow-ups**: the Actions Node-20
  version bump (`@v4 → @v5`; mechanical, self-contained — now confirmed live
  in CI annotations, a good first pick), settings-defaults single source of
  truth, npm audit triage (3 high in root — all the `ws`/supabase-js chain —
  plus 9 in `mcp/`), and the new **`userEmail` dead-threading** decision (build
  the account affordance vs. remove the prop threading — see
  [design-flags.md](design-flags.md)). For any new UI round, the rhythm is
  mocks-first on the review board (same artifact URL; toolkit + templates in
  `scripts/review-board/`, README has the flow).
- **Blockers:** None.
- **Environment notes:** `.env.local` exists (prod DB access verified,
  PG 17.6); read-only Supabase MCP configured in `.mcp.json` (owner OAuth
  pending first use); `gh` holds both accounts (`2a-webteam` active machine-
  wide, `mitchthompson` pinned per command via
  `GH_TOKEN=$(gh auth token --user mitchthompson)`); local Supabase stack runs
  on Colima (`supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`).

## Page status

Routes confirmed against `app/`. Per-page intent lives in `docs/pages/<slug>.md`
([settings](pages/settings.md) and [recipes](pages/recipes.md) are current;
the other three are stubs the redesign brief supersedes).

| Page | Route | Status |
| --- | --- | --- |
| Today | `/` (`app/page.tsx`) | Working — reflow home screen ("Tonight" hero shows up to two meals + "Also tonight", deadline strip, week peek without meal-type sublabels, nudge); data layer in `lib/hooks/use-today.ts` |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working — v2 pass shipped (PR #21): page title + card labels, teal links, 44px targets, full-width save, serves line + sample-data seeder removed; atomic `save_recipe` RPC live; mobile editor takeover (PR #17); data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working — v2 pass shipped (PR #22): flat hairline rows, full-width teal "Start cooking" (launches `components/cook-mode.tsx`), breadcrumb + one-row actions, pantry-badge quirk fixed |
| Plan | `/plans` (`app/plans/page.tsx`) | Working — flat day lists (no lunch/dinner division, PR #18; `meal_type` vestigial), per-day quick-add (44px rows, recents first), sheets, generate exit; day items in `components/plan-day-items.tsx`; data layer in `lib/hooks/use-plan.ts` |
| Shop | `/grocery` (`app/grocery/page.tsx`) | Working — reflow chunky direction (pinned order bar, 30px checks, sticky sections); transactional state-preserving regeneration underneath; data layer in `lib/hooks/use-grocery-list.ts` |
| Settings | `/settings` (`app/settings/page.tsx`) | Working — v2 pass shipped (PR #20): iOS-style rows, page title + card labels, 44px targets, full-width teal save; `ensureUserSettings` runs once per sign-in (defaults duplication still open) |

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
| 7 | V2 Sweep | **Done (2026-07-02)** — token fix (PR #19), Settings (PR #20), Recipes library/editor (PR #21), recipe detail (PR #22); all board pins from rounds 2–4 resolved |

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

- Ten round-1 review-board pins await owner verdicts (shipped defaults, not
  bugs): T1–T4, P1–P3, S1–S2, C2 — see [design-flags.md](design-flags.md).
- Default settings values duplicated across client files vs SQL defaults
  (standalone follow-up — split out of M6 by owner decision, 2026-07-02).
- No route-level `error.tsx` / `loading.tsx` boundaries; unmapped errors still
  surface raw messages (mini-M5 added friendly mapping + `aria-live`).
- `AppShell` receives `userEmail` from all six screens but renders it nowhere
  — build the account affordance or remove the dead threading (new flag,
  2026-07-03; see [design-flags.md](design-flags.md)).
- `npm audit`: 3 high-severity in root (all the `ws → realtime-js →
  supabase-js` chain), 9 in `mcp/` — triage pending.
- Full register: [design-flags.md](design-flags.md).

## Where to go next

- Redesign intent — [redesign-brief.md](redesign-brief.md)
- Milestones and deferred work — [roadmap.md](roadmap.md)
- Verification and runbooks — [qa.md](qa.md), [architecture.md](architecture.md)
- Data model — [data-model.md](data-model.md) (canonical: `supabase/schema.sql`)
- Decisions and history — [decisions.md](decisions.md), [progress-log.md](progress-log.md)
