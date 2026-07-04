# Current State

Last reviewed: 2026-07-04 (execution session: **Recipe Import PR 2 / Phase C shipped** — the in-app import UI. Built C1–C6 on `codex/import-ui` (round-5 verdicts applied), Phase D senior review fixed 3 bugs + 3 cleanups, gate green (vitest 125/125, `verify-recipes-pass` 22/22 proving the C1 seam neutral, `verify-import-pass` 26/26); **PR #29 merged to `main` (`88a6bc5`) and deployed to Vercel prod** — the `/recipes` import flow is live. Same PR carried the PR-1 docs-wrap commit `9601b1f`. **Milestone 8 (Recipe Import) is functionally complete** — phases A/B/C/D all shipped. **First real use then surfaced a tags-cap bug — an NYT paste failed with a misleading "(not both)" 400 because the request schema capped `tags` at 50 and the household has 82 — fixed in a hotfix (PR #31, `main` `cbb1c57`): cap 50→500 + a `conflicting_source` code so field errors read clearly. Owner confirmed a live NYT paste import works end to end.** See Active Handoff. Prior: PR 1 server route PR #28 (`11834f9`); iPad coherence PRs #26–#27)

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
lint` works again on a flat config and CI enforces it. A **follow-up cleanup
session (2026-07-03) then cleared four standing items**, all merged directly
to `main`: CI Actions bumped `@v4` to `@v5` (Node-20 deprecation gone), the
`ws` advisory resolved to **0 npm-audit vulns** via a lockfile-only
supabase-js bump, settings defaults consolidated to a single
`DEFAULT_USER_SETTINGS` source of truth, and the unused `userEmail` prop
threading removed from the shell + five screens. The **ten open round-1
review-board pins were then signed off (2026-07-03): every default kept, no
code changes** (T1–T4 Today, P1–P3 Plan, S1–S2 Shop, and C2 — mark-cooked
stays a no-op exit). **All review-board pins (rounds 1–4) are now resolved**
and the standing follow-up queue is drained. This session then **cleared the
entire remaining backlog** (2026-07-03): the CI baseline-vs-`schema.sql` drift
guard (PR #24), the `schema.sql` baseline/ALTER consolidation (PR #25), and the
`mcp/` npm-audit fix (9 → 0, direct to `main`). The next session then **shipped
iPad coherence** ([plans/ipad-support.md](plans/ipad-support.md)) in two CSS-only
PRs — **chrome PR #26** (portrait iPads → phone tabbar, landscape → desktop nav,
via a `(pointer: coarse) and (max-width: 1024px)` trigger) and **content-width
PR #27** (portrait tablets fill the shell instead of stranding a right gutter) —
both deployed and confirmed on an iPad Pro. A planning session then scoped
**in-app Recipe Import** (paste text or URL → LLM parse → dedicated review
screen → save) into a locked, builder-ready spec at
[plans/recipe-import.md](plans/recipe-import.md); Phase A (board mocks) + Phase B
(server route) were built 2026-07-03; and **this session (2026-07-04) shipped PR
1 end to end**: round-5 board verdicts (IM1–IM7) collected + recorded, Phase D
senior review applied 7 fixes (SSRF guard hardened against redirect/mapped-IPv6/
FQDN-root bypasses, step-range corruption fixed, `roundAmount` reuse), the live
B13 smoke passed against the Anthropic API (all 4 spec deviations resolved,
including the root-level `anyOf` schema confirmed live), and **PR #28
(`codex/import-api`) merged to `main` (`11834f9`) and deployed to Vercel prod**
(route live on `meal-queue.vercel.app`; `ANTHROPIC_API_KEY` set locally + in
Vercel). **This session (2026-07-04) then shipped Phase C — the in-app import
UI** on `codex/import-ui`: C1 extracted a shared `saveRecipeForm` seam
(behavior-neutral), C2 added `use-import.ts` + the pure `draftToFormState`
mapper, C3 built `components/recipe-import.tsx` (`ImportFlow`: entry/parsing/
review), C4 wired the Import button + `?import=1` into the recipes page, C5 the
token-only import CSS, C6 the `verify-import-pass.mjs` harness + docs. A Phase D
`/code-review` fixed 3 bugs (abort-vs-reset coordination, `?edit`+`?import`
mutual-exclusion, paywall focus) + 3 cleanups; **PR #29 merged to `main`
(`88a6bc5`) and deployed** (carrying the PR-1 docs-wrap `9601b1f`).
**Milestone 8 is functionally complete** (phases A/B/C/D done); the only tail is
the Needs-Mitchell real-device pass. See Active Handoff.

## Stable Baseline

- **`main`:** at `cbb1c57` (**import tags-cap hotfix, PR #31** — `codex/fix-import-tags-cap`: raised the request-schema `tags` cap 50→500 and added the `conflicting_source` error code so validation failures stop reading as "(not both)"; server-only, deployed) atop `88a6bc5` (**Recipe Import PR 2 / Phase C** — merge of `codex/import-ui` (PR #29): the in-app import UI — `components/recipe-import.tsx`, `lib/hooks/use-import.ts` + `draft-to-form.ts`, the shared `saveRecipeForm` seam, token-only import CSS; deployed to Vercel prod, `/recipes` import flow live; the same PR also carried the PR-1 docs-wrap `9601b1f`) atop `11834f9` (**Recipe Import PR 1** — `codex/import-api`: the app's first server-side route `POST /api/import-recipe` + `lib/import/*`, additive and inert), `45d5260` (recipe-import spec) and the iPad-coherence merges — the full
  reflow (PRs #13–#16), review round 1
  (PRs #17–#18), the complete v2 sweep (PRs #19–#22, merge `74da4ea`), the
  **ESLint/CI lint gate (PR #23, merge `83d0b86`)**, the **2026-07-03
  standing-follow-up cleanup** (CI actions v5 merge `2e8bc09`; ws advisory +
  settings-defaults SoT + userEmail cleanup merge `aada18f`), the **2026-07-03
  backlog-clearing session** (round-1 pin sign-off docs `ca0c131`, CI baseline
  drift guard PR #24 merge `cbe424b`, `schema.sql` consolidation PR #25 merge
  `5308e4a`, `mcp/` npm-audit fix `443c9c6` direct-to-main), and the **2026-07-03
  iPad-coherence work**: chrome **PR #26** (merge `e0a6a3c`) + portrait
  content-width **PR #27** (merge `a40b90a`) — all deployed on Vercel. The
  direct-to-main merges were low-risk (docs / lockfile / CI). Merge to `main`
  auto-deploys (confirmed); Cook was owner-verified on-device in prod, and the
  iPad chrome + width fixes were confirmed live in the production CSS bundle and
  on the owner's iPad Pro.
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only. schema.sql was consolidated
  2026-07-03 (historical inline `ALTER`s folded into the base DDL, 735 → 699
  lines) — proven effect-identical by a fresh-build `pg_dump` diff, so prod is
  unaffected.
- **CI:** GitHub Actions on every PR — app checks (**lint** / typecheck /
  vitest / build) and DB tests (ephemeral Supabase stack, 108 pgTAP assertions
  across three suites), CLI pinned 2.109.0, NOTESTS guard. The db-tests job
  also guards baseline drift — a "Baseline schema matches schema.sql" step runs
  before `supabase start` and fails if the baseline migration and `schema.sql`
  diverge (2026-07-03). Lint runs
  `eslint . --max-warnings=0` on the flat config (PR #23); `next build` no
  longer lints (`eslint.ignoreDuringBuilds`). Thirty-one PRs merged plus several
  direct-to-main follow-up merges; CI has been green (one transient
  `supabase start` port-bind flake on `main` — `54322 already in use` — cleared
  by a job rerun, not a repo issue).
  `actions/checkout` and `actions/setup-node` are now on `@v5` (2026-07-03,
  merge `2e8bc09`), clearing the Node-20 runtime deprecation;
  `supabase/setup-cli@v1` stays (no v5) and `node-version: 20` is unchanged.
- **Latest verification:** 2026-07-04 (import tags-cap hotfix, PR #31): eslint /
  tsc clean, **vitest 128/128** (125 + 3 tag-cap/refine-shape tests), `next build`
  12 routes, `verify-import-pass` 26/26; **live-route probes on the local and prod
  route** (no LLM spend — validation runs before the auth gate): 82 tags + text →
  401 (validation passes; was 400 before the fix), both/neither →
  `conflicting_source`, tag>40 → generic `invalid_request`, text>25k →
  `text_too_long`. Prior — 2026-07-04 (Recipe Import PR 2 / Phase C, PR #29):
  eslint / tsc clean, **vitest 125/125** (119 + 6 new `draftToFormState`),
  `next build` **12 routes** (`/recipes` 8.08 kB with the import UI added;
  `/api/import-recipe` node fn unchanged); **`verify-recipes-pass.mjs` 22/22**
  (proves the C1 `saveRecipeForm` seam neutral, live `save_recipe` round-trip) +
  **`verify-import-pass.mjs` 26/26** (entry→parsing→review→save→detail, plus the
  422-red and paywall-amber+focus paths; the `/api/import-recipe` route was
  intercepted with fixtures — no LLM spend; one transient `ensureUserSettings`
  "Failed to fetch" in a recipes-pass run cleared on re-run). PR #29 CI green
  (app-checks 50s, db-tests 1m11s), `main` post-merge CI green (1m4s); prod
  liveness `/recipes` 200 + `POST /api/import-recipe` 400 on an empty body (body
  validation before auth); DB layer untouched (pgTAP unchanged at 108). Prior —
  2026-07-04 (Recipe Import PR 1, PR #28): eslint /
  tsc clean, **vitest 119/119**, `next build` 11 pages + `/api/import-recipe` as
  a `ƒ` node function (built with no key present); PR #28 CI green (app-checks
  48s, db-tests 1m4s), `main` post-merge CI green (1m8s), DB layer untouched
  (pgTAP unchanged at 108). **Live B13 smoke** against prod Supabase auth + the
  Anthropic API: paste path (fraction/range/to-taste normalization correct), URL
  path (`meta.extraction:"json-ld"`, 20 ingredients), negatives (401 / 422
  no_recipe_found / 400 invalid_request) — all pass; root-level `anyOf` schema
  confirmed accepted by the live API. Prod route liveness confirmed on
  `meal-queue.vercel.app` (401 no-auth; a full authed prod call to confirm the
  key wiring is deferred — it costs a paid request). Prior — 2026-07-03 (iPad
  coherence): chrome **PR #26** —
  6-viewport × 6-screen Chromium sweep on the local stack (portrait 744/820/834/
  1024 → tabbar on, pills hidden; landscape 1194/1366 → pills kept, touch-sized)
  + a boundary regression probe (phone-390 and desktop-1280-mouse unchanged);
  app-checks 51s / db-tests 1m1s; live prod CSS grep confirmed the trigger.
  Content-width **PR #27** — page-col width probe (11″ portrait 640→802, 12.9″
  640→928, landscape/desktop 640 unchanged), re-swept both iPad Pro portraits;
  app-checks 46s / db-tests 1m3s; live prod CSS confirmed the fill rule; owner
  confirmed on iPad Pro. Both: eslint / tsc clean, vitest 16/16, `next build`
  11/11, DB layer untouched (no pgTAP change). Prior (backlog-clearing session):
  CI baseline guard PR #24 green (db-tests 1m1s; the guard step ran and passed;
  fail-on-drift verified locally); schema.sql consolidation PR #25 — fresh-build
  `pg_dump --schema-only` of old vs new baseline byte-identical (only pg_dump's
  random session nonce differs), pgTAP 108/108, CI green; mcp/ npm-audit 9 → 0
  (in-range lockfile-only), `tsc` clean + a live MCP `initialize` handshake over
  stdio, `main` CI green after a rerun cleared a transient port-bind flake.
  Prior (standing-follow-up cleanup, 2026-07-03): eslint 0
  warnings, typecheck clean, vitest 16/16, `next build` 11/11 pages, root
  `npm audit` 0; CI green on both `main` merges (actions-v5 1m12s, cleanup
  1m14s), pgTAP 108/108 (DB layer untouched). Prior same day (ESLint/CI gate,
  PR #23) — `eslint .`
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

- **Just shipped:** **Recipe Import PR 2 / Phase C — merged & deployed.** PR #29
  (`codex/import-ui` → `main` `88a6bc5`, feature branch deleted) is live on Vercel
  prod: the in-app import UI — `components/recipe-import.tsx` (`ImportFlow`:
  entry/parsing/review), `lib/hooks/use-import.ts` + the pure
  `lib/hooks/draft-to-form.ts` mapper, the shared `saveRecipeForm` seam in
  `lib/hooks/use-recipes.ts`, and token-only import CSS. Round-5 verdicts applied,
  Phase D `/code-review` fixed 3 bugs + 3 cleanups, vitest **125/125**,
  `verify-recipes-pass` 22/22 (C1 neutral) + `verify-import-pass` 26/26. The same
  PR carried the PR-1 docs-wrap `9601b1f`. **Milestone 8 (Recipe Import) is
  functionally complete** (phases A/B/C/D done). Zero schema changes, zero new
  npm deps. **Post-merge hotfix (PR #31, `main` `cbb1c57`): the first real import
  (owner, NYT paste) hit a tags-cap bug — the request schema capped `tags` at 50
  but the household has 82, so the whole request 400'd with a misleading
  "(not both)" message. Fixed server-side (cap 50→500; new `conflicting_source`
  code so field errors read clearly; +3 tests). Verified on the live prod route
  and owner-confirmed working end to end — this was the first live in-app
  import.**
- **Next action:** **No approved milestone is queued** — Recipe Import (milestone
  8) was the last active one and is now done. `/onboard`, then **await owner
  direction** for the next build. The one open item is owner-run, not an agent
  task: the **Needs-Mitchell real-device import pass** — on `npm run dev:phone`,
  iPhone standalone (never prod), paste an actual NYT Cooking recipe end to end,
  do one open-site URL import, trigger the paywall redirect, and check
  keyboard-over-textarea + safe-area under the teal save bar (Playwright WebKit ≠
  real Safari). When the owner picks the next milestone, unscoped candidates live
  in [roadmap.md](roadmap.md) Deferred Fixes/Ideas: route-level
  `error.tsx`/`loading.tsx` boundaries, optimistic UI, auth-flow completion
  (sign-up confirmation / password reset), richer empty states / dark mode. None
  are scoped yet — interview + spec first, per the house rhythm.
- **Blockers:** none.
- **Environment notes:** `main` is the working branch (feature branch
  `codex/import-ui` merged + deleted, local and remote). `.env.local` includes
  `ANTHROPIC_API_KEY` (sk-ant-, present locally); **Vercel has `ANTHROPIC_API_KEY`
  set for Production + Preview** (owner-provisioned). The review-board dev server
  used for the Phase C verifies (`:3123`, local-pointed) was stopped at wrap.
  **Key rotation:** the raw key value was briefly exposed in a session transcript
  (IDE selection) — rotation was recommended but the owner chose to **leave it
  as-is for now**; rotate if that changes (Console → API Keys → revoke
  `meal-queue-vercel` → recreate → update `.env.local` + Vercel). `.env.local`
  prod DB access verified (PG 17.6); read-only Supabase MCP configured in
  `.mcp.json` (owner OAuth pending first use); `gh` holds both accounts
  (`2a-webteam` active machine-wide, `mitchthompson` pinned per command via
  `GH_TOKEN=$(gh auth token --user mitchthompson)`); local Supabase stack runs
  on Colima (`supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`),
  left up this session.

## Page status

Routes confirmed against `app/`. Per-page intent lives in `docs/pages/<slug>.md`
([settings](pages/settings.md) and [recipes](pages/recipes.md) are current;
the other three are stubs the redesign brief supersedes).

| Page | Route | Status |
| --- | --- | --- |
| Today | `/` (`app/page.tsx`) | Working — reflow home screen ("Tonight" hero shows up to two meals + "Also tonight", deadline strip, week peek without meal-type sublabels, nudge); data layer in `lib/hooks/use-today.ts` |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working — v2 pass shipped (PR #21): page title + card labels, teal links, 44px targets, full-width save, serves line + sample-data seeder removed; atomic `save_recipe` RPC live; mobile editor takeover (PR #17); **in-app import shipped (PR #29): Import button + `?import=1` → paste/URL → LLM parse → review screen → save via the shared `saveRecipeForm`** (`components/recipe-import.tsx`, `lib/hooks/use-import.ts`); data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working — v2 pass shipped (PR #22): flat hairline rows, full-width teal "Start cooking" (launches `components/cook-mode.tsx`), breadcrumb + one-row actions, pantry-badge quirk fixed |
| Plan | `/plans` (`app/plans/page.tsx`) | Working — flat day lists (no lunch/dinner division, PR #18; `meal_type` vestigial), per-day quick-add (44px rows, recents first), sheets, generate exit; day items in `components/plan-day-items.tsx`; data layer in `lib/hooks/use-plan.ts` |
| Shop | `/grocery` (`app/grocery/page.tsx`) | Working — reflow chunky direction (pinned order bar, 30px checks, sticky sections); transactional state-preserving regeneration underneath; data layer in `lib/hooks/use-grocery-list.ts` |
| Settings | `/settings` (`app/settings/page.tsx`) | Working — v2 pass shipped (PR #20): iOS-style rows, page title + card labels, 44px targets, full-width teal save; `ensureUserSettings` runs once per sign-in; settings defaults now share one `DEFAULT_USER_SETTINGS` source of truth mirroring SQL (2026-07-03) |

Authentication is email/password through Supabase. The app installs to the
iPhone home screen as a standalone app (manifest + icons + safe-area handling,
mini-M5). **iPad is supported app-wide** (2026-07-03): portrait tablets get the
phone tabbar chrome and fill-width content, landscape tablets get the desktop
top-nav — all screens, CSS-only (PRs #26–#27; [plans/ipad-support.md](plans/ipad-support.md)).

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
| 6 | Component Hardening | Done — slices 1–4 (PRs #7, #9, #10, #12); settings-defaults single source of truth done 2026-07-03 |
| — | The Reflow (redesign) | Done (2026-07-02) — Cook (PR #13), Today (PR #14), Shop (PR #15), Plan (PR #16); token set v2 live app-wide ([redesign-brief.md](redesign-brief.md)) |
| — | Reflow review round 1 | **Done (2026-07-02)** — quiet cook line + mobile recipe editor (PR #17); flat day lists, mobile quick-add, two-meal hero (PR #18); all 10 board pins signed off 2026-07-03 (defaults kept) |
| 7 | V2 Sweep | **Done (2026-07-02)** — token fix (PR #19), Settings (PR #20), Recipes library/editor (PR #21), recipe detail (PR #22); all board pins from rounds 2–4 resolved |
| — | iPad coherence | **Done (2026-07-03)** — orientation-routed chrome (PR #26) + portrait content-width fill (PR #27); CSS-only, deployed & confirmed on iPad Pro ([plans/ipad-support.md](plans/ipad-support.md)) |
| 8 | Recipe Import (in-app) | **Done (2026-07-04)** — PR 1 (server route, PR #28 `11834f9`) + **PR 2 / Phase C (import UI, PR #29 `codex/import-ui` → `main` `88a6bc5`)**: paste/URL → LLM parse → review → save via shared `saveRecipeForm`; vitest 125/125, verify-recipes-pass 22/22 (C1 neutral) + verify-import-pass 26/26, deployed to prod. Phases A/B/C/D all shipped; only the owner real-device pass remains. Spec: [plans/recipe-import.md](plans/recipe-import.md) |

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

- Round-1 review-board pins signed off 2026-07-03 (all defaults kept, no code
  changes); C2 (mark-cooked no-op) can still be revisited as a schema change
  if a consumer appears — see [design-flags.md](design-flags.md).
- No route-level `error.tsx` / `loading.tsx` boundaries; unmapped errors still
  surface raw messages (mini-M5 added friendly mapping + `aria-live`).
- iPad: two optional tails (owner's call, not blocking) — a final real-device
  pass (portrait fill + landscape + iPadOS standalone), and centring the
  landscape 640px reading column (currently left-pinned, owner-accepted).
- Recipe Import PR 1: two optional tails (owner's call, not blocking) — an
  **authed prod smoke** to confirm the Vercel `ANTHROPIC_API_KEY` wiring (a
  no-auth probe can't verify it; costs one paid call), and **key rotation** (the
  raw key value was briefly exposed in a session transcript; owner chose to leave
  it for now).
- Recipe Import Phase C: **the owner confirmed a live NYT paste import works end
  to end** (after the PR #31 tags-cap hotfix). Remaining real-device tails
  (owner-run on `npm run dev:phone`, not blocking): one **open-URL import**, the
  **paywall redirect** path, and **keyboard-over-textarea / safe-area** under the
  teal save bar (Playwright WebKit ≠ real Safari). Two unpinned CSS values remain
  flagged for owner eyes — `.import-textarea` min-height `9rem` and the
  `.import-progress` `1.1s` sweep (see [design-flags.md](design-flags.md)).
- `npm audit`: **both packages clean (0 vulns)** as of 2026-07-03 — root via
  the supabase-js lockfile bump (`ws` chain), and `mcp/` via an in-range
  lockfile-only `npm audit fix` (9 → 0: `undici`/`ws`/`hono`/`express`/`qs`/
  etc., all transitive, `package.json` unchanged). Verified: server rebuilds
  (`tsc`) and answers an MCP `initialize` handshake over stdio.
- Full register: [design-flags.md](design-flags.md).

## Where to go next

- Redesign intent — [redesign-brief.md](redesign-brief.md)
- Milestones and deferred work — [roadmap.md](roadmap.md)
- Verification and runbooks — [qa.md](qa.md), [architecture.md](architecture.md)
- Data model — [data-model.md](data-model.md) (canonical: `supabase/schema.sql`)
- Decisions and history — [decisions.md](decisions.md), [progress-log.md](progress-log.md)
