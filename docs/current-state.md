# Current State

Last reviewed: 2026-07-02

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**The reflow is complete; the v2 sweep (milestone 7) is half done.**
Milestones 0–4, mini-M5, and milestone 6 are done; the database layer is
atomic, race-free, and state-preserving (108 pgTAP assertions in CI), with
data layers in `lib/hooks/`. The redesign ([redesign-brief.md](redesign-brief.md))
shipped screen by screen on 2026-07-02 (Cook PR #13, Today PR #14, Shop
PR #15, Plan PR #16), review round 1 (PRs #17–#18) landed the same day
(flat day lists — `meal_type` is vestigial, no schema change — quiet cook
line, mobile editor takeover), and the **v2 sweep then shipped its first
half** (same day): **PR #19** retired every hardcoded old-palette literal
in `app/globals.css` for token-set-v2 variables (acceptance grep: hex hits
`:root` only), and **PR #20** rebuilt Settings in the v2 layout language
per the round-2 board verdicts (iOS-style rows, page title + card labels,
44px targets, full-width teal save). **Next: the Recipes library + editor
pass, mocks-first**, then recipe detail ([roadmap.md](roadmap.md)
milestone 7 part 2). Ten round-1 review-board pins are still open in
[design-flags.md](design-flags.md); the round-2 pins (V1–V2, ST1–ST3) are
all resolved and shipped.

## Stable Baseline

- **`main`:** at `83cb415` — the full reflow (PRs #13–#16), review round 1
  (PRs #17–#18), and the v2 sweep's first half: the token fix (PR #19,
  merge `e5d2cfd`) and the Settings v2 pass (PR #20, merge `83cb415`), all
  deployed on Vercel. Merge to `main` auto-deploys (confirmed); Cook was
  owner-verified on-device in prod.
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (typecheck / vitest / build)
  and DB tests (ephemeral Supabase stack, 108 pgTAP assertions across three
  suites), CLI pinned 2.109.0, NOTESTS guard. Twenty PRs merged; every PR's
  first CI run has been green. Housekeeping flag: the workflow's
  `actions/*@v4` actions warn about deprecated Node 20 — bump versions in
  passing.
- **Latest verification:** 2026-07-02 (v2 sweep) — typecheck clean, vitest
  16/16, `next build` green on both branches; pgTAP 108/108 in CI (DB layer
  untouched again). Both branches driven with Playwright on the local stack:
  PR #19 — 22/22 computed-style assertions across Settings / recipes list /
  editor / recipe detail at 390px, full-DOM scan zero retired palette
  values, zero prod requests (route-blocked); PR #20 — 13/13 layout
  assertions plus a live save round-trip (7→9, persisted through reload,
  reverted) — zero console errors throughout.
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** None — v2 sweep part 1 (PR #19) and the Settings pass
  (PR #20) are merged and deployed; all branches merged, tree clean.
- **Next action:** **the Recipes library + editor v2 pass, mocks-first**
  (the Settings pass is the pattern — PR #20). Steps for a stranger:
  (1) start the local stack + dev server on port 3123 (inline local
  `NEXT_PUBLIC_*` env; see `scripts/review-board/README.md`), (2) capture
  `/recipes` (list, and editor open — tap a list item's "Edit") at 390px,
  (3) build 2 CSS-injected direction mocks bringing the screen's layout
  language in line with the cycle screens (card labels, spacing, 44px thumb
  targets — reuse `scripts/review-board/capture-settings-variants.mjs` as
  the template), (4) redeploy the review board **to its existing artifact
  URL** with RC-prefixed pins and get owner verdicts, (5) then branch
  `codex/v2-recipes` off `main` and implement per the verdicts,
  behavior-neutral, following `app/settings/page.tsx` + the `.settings-*`
  group in `app/globals.css` (PR #20) as the class-naming pattern. After
  Recipes: **recipe detail** (same rhythm; also resolve the pantry-badge
  text-color cascade quirk — `.recipe-meta span` overrides `.pantry-badge`,
  see the flag). Then: the 10 open round-1 board pins, then the standing
  follow-ups (settings-defaults single source of truth, ESLint config + CI
  lint step, npm audit triage — 1 high root, 9 in `mcp/` — and the Actions
  Node-20 version bump).
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
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; atomic `save_recipe` RPC live; on mobile the editor takes over the screen ("‹ Back to recipes", PR #17); data layer in `lib/hooks/use-recipes.ts`; pre-v2 layout language — **next v2 sweep target** |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working; "Start cooking" launches the reflow's full-screen Cook mode (`components/cook-mode.tsx`); colors tokenized (PR #19) but pre-v2 layout language — v2 sweep target after Recipes (incl. the badge text-color cascade quirk) |
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
| 7 | V2 Sweep | **In progress** — part 1 token fix done (PR #19) and Settings pass done (PR #20), both 2026-07-02; remaining: Recipes library/editor → recipe detail ([roadmap.md](roadmap.md)) |

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

- V2 sweep remainder: Recipes library/editor and recipe detail keep the
  pre-reflow layout language (the `globals.css` literals are gone — PR #19 —
  and Settings is done — PR #20). Recipe detail also carries the
  pantry-badge text-color cascade quirk ([design-flags.md](design-flags.md)).
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
