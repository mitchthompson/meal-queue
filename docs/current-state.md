# Current State

Last reviewed: 2026-07-11 (**Milestone 11 shipped** — the owner signed off AR2 (verdict A, last open pin) and configured the Supabase redirect URLs; PR #37 (`codex/password-reset` → `main` `7e66dd5`) merged and deployed the same day, and the owner completed the prod real-device pass (live iPhone Safari reset, confirmed working). M11 is fully closed; zero schema, zero deps. Also same day: the tracked `.claude/skills/{onboard,wrap}` were swapped for symlinks into `~/Dev/claude-skills` (chore `88a7a53`). Prior the same day: **doc de-rot pass** — the 2026-07-11 doc audit's corrections applied across the doc set ([plans/doc-derot-2026-07-11.md](plans/doc-derot-2026-07-11.md)); no code changed. Git reality restated: M11 is **committed** on `codex/password-reset` (`391ebe1` feat · `e2b7ea5` test · `b92db61` docs wrap), rebased onto `main` `6fb32b2` (PR #36), unpushed/unmerged, owner gates unchanged; the de-rot pair (`6482a5e`/`8abb9b3`) and a 2026-07-11 skills-symlink chore commit sat on the same branch (all since merged via PR #37, above). Prior 2026-07-08: **Post-use UX fixes shipped & deployed** — three issues from real use (Today deep-link CTAs; the add-meal full-screen takeover; "Shop this plan") built on `codex/ux-feedback-fixes` off `main` `cc1e6ec`; an adversarial review found + fixed 4 edge/a11y issues; gate green + a real-app pass (12 shots, 0 console errors); owner signed off the review board → merged to `main` & deployed to Vercel. Zero schema, zero deps. See Active Handoff / [progress-log](progress-log.md). **Aside:** Milestone 11 (password reset) is built and verified on `codex/password-reset` (committed there, unpushed/unmerged): vitest 138/138, `verify-reset-pass` 25/25 (incl. a real Mailpit recovery-email round-trip), senior `/code-review` (high) clean, board pin **AR1: A**. Owner gates still open before merge: AR2 sign-off, Supabase redirect URLs, a prod real-device pass, then push/PR/merge. Prior 2026-07-05: **Milestone 10 complete — PR 2 (optimistic writes) shipped & deployed** — PR #35 (`codex/optimistic-writes` → `main` `1d16ef8`) is live on Vercel prod: item-level mutations (grocery toggle/bucket/pantry/on-hand, plan adjustServing/removeItem/addMeal) now patch local React state before the write and roll back per-item on failure, and the plan/recipe form saves dropped their blocking refetches (the atomic `save_recipe` RPC await stays); senior `/code-review` (high) found + fixed 3 issues (a refresh-after-write rollback regression, a concurrent stale-snapshot clobber hardened to **targeted functional rollback**, and a same-millisecond temp-id collision); **vitest 138/138**, new `verify-optimistic-pass` **16/16** (a grocery check and a plan remove each render <200ms under a 1500ms-delayed network, and both roll back + show the red error on `route.abort`), regression harnesses re-run green (shop 22/22, recipes 22/22, import 26/26); PR #35 CI green + `main` post-merge CI green on the first run; the docs-wrap `7a0df26` from PR 1 rode along inside PR #35, so `origin/main` and local `main` are back in sync; zero schema, zero deps. This closes the "no optimistic UI" flag and completes milestone 10. Prior 2026-07-05: **Milestone 10 PR 1 (Shop stale banner) shipped & deployed** — PR #34 (`codex/shop-stale-banner` → `main` `41fa28b`) is live on Vercel prod: the Shop page's silent regenerate-on-load is replaced by an amber staleness banner + explicit Generate/Update button — it **never auto-regenerates** and the list stays usable while stale. Board pin **SB1: A (amber)** signed off; senior `/code-review` (high) applied one fix (the new banner briefly flashed the previous plan's state on a plan switch → reset `setStale(false)` at the top of `loadGroceryItems`); **vitest 138/138**, new `verify-shop-pass` harness **22/22** (proves no regen-on-load and that checked items survive a user-triggered update — the M4 guarantee, now user-initiated); post-merge `main` CI needed one rerun (the known transient `supabase start` `54322` port-bind flake, not a code issue); zero schema, zero deps. Prior 2026-07-05: **Milestone 9 (Resilience) shipped & deployed** — PR #33 (`codex/error-boundaries` → `main` `8f1cd46`): root boundaries, a recipe-detail 404, a `toAuthErrorMessage` mapper, and the 17-site raw-`setError(x.message)` sweep; EB1 signed off, **vitest 138/138**, prod 404 panel live; zero schema, zero deps. Earlier the same day a planning session **scoped milestones 9-15** — seven builder-ready specs in `docs/plans/` (M9 now shipped; M10 responsiveness, M11 password reset, M12 grocery unit merge (DB), M13 plan copy, M14 dark mode, M15 empty states), recipe-import handoff format, owner forks locked. **M10 was then approved and shipped (above); M11 is approved and built on `codex/password-reset` (verified, unmerged, owner gates open); M12-M15 remain unapproved.** See Active Handoff. Prior session 2026-07-04: **Recipe Import PR 2 / Phase C shipped** — the in-app import UI. Built C1–C6 on `codex/import-ui` (round-5 verdicts applied), Phase D senior review fixed 3 bugs + 3 cleanups, gate green (vitest 125/125, `verify-recipes-pass` 22/22 proving the C1 seam neutral, `verify-import-pass` 26/26); **PR #29 merged to `main` (`88a6bc5`) and deployed to Vercel prod** — the `/recipes` import flow is live. Same PR carried the PR-1 docs-wrap commit `9601b1f`. **Milestone 8 (Recipe Import) is functionally complete** — phases A/B/C/D all shipped. **First real use then surfaced a tags-cap bug — an NYT paste failed with a misleading "(not both)" 400 because the request schema capped `tags` at 50 and the household has 82 — fixed in a hotfix (PR #31, `main` `cbb1c57`): cap 50→500 + a `conflicting_source` code so field errors read clearly. Owner confirmed a live NYT paste import works end to end.** See Active Handoff. Prior: PR 1 server route PR #28 (`11834f9`); iPad coherence PRs #26–#27)

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**Milestone 11 (password reset) is complete — PR #37 (`codex/password-reset`
→ `main` `7e66dd5`) merged and deployed 2026-07-11, and the owner completed
the prod real-device pass the same day (live reset round-trip on iPhone
Safari, confirmed working).** Built 2026-07-06 from
[plans/password-reset.md](plans/password-reset.md): `components/auth-gate.tsx`
gains a "Forgot password?" link + `requestPasswordReset`
(`resetPasswordForEmail` → `${origin}/reset-password`, reusing M9's
`toAuthErrorMessage`); new `app/reset-password/page.tsx` (recovery-session form:
loading / expired / new-password states, `updateUser({ password })`) +
`layout.tsx`. Senior `/code-review` clean; 3 low-severity notes applied
(`disabled={busy}`, toggle clears the status line, title case). Board round **AR**
(🍳 artifact) caught a real link-collision on the sign-in screen → **owner picked
AR1: A**, shipped as the `.auth-links` column wrapper in `app/globals.css`. **AR2
(the reset page) signed off 2026-07-11, verdict A — all AR pins resolved.**
Verified: vitest 138/138, `next build`
13 routes, `scripts/review-board/verify-reset-pass.mjs` **25/25** (real Mailpit
round-trip); PR #37 CI green (app-checks 58s, db-tests 1m10s), `main`
post-merge CI green on the first run (1m7s), prod probes `/` 200 +
`/reset-password` 200 + `/nonexistent` 404. Zero schema, zero deps. **All
owner gates cleared 2026-07-11: AR2 verdict A, redirect URLs configured,
merge word given, prod iPhone pass done.** The PR also carried the 2026-07-11
doc de-rot pair, the skills-symlink chore, and the gate-record docs wrap.
Milestones 0–11 are complete (below).

**Milestone 10 is complete** (2026-07-05). **PR 2 (optimistic writes) is shipped
and deployed** (PR #35 `1d16ef8`): item-level mutations in
`lib/hooks/use-grocery-list.ts` (`toggleChecked`, `setCheckedForBucket`,
`movePantryToMain`, `setOnHand`) and `lib/hooks/use-plan.ts` (`adjustServing`,
`removeItem`, `addMeal`) patch local state before the network write and roll back
only the touched item on failure; `lib/hooks/use-recipes.ts` (`saveRecipe`,
`deleteRecipe`) patch the list locally instead of a full reload. The plan
mutations keep `refreshPlansAndKeepSelection` but drop the `loadPlanItems`
refetch; `saveRecipeForm`, `supabase/**`, and `app/api/**` are untouched. Closes
the "no optimistic UI" flag. **PR 1 (Shop stale banner) shipped earlier the same
day** (PR #34 `41fa28b`): the Shop page no longer silently regenerates the
grocery list on load. When `groceries_version !== version` it shows an amber
banner (`.shop-stale-banner`) with an explicit Generate/Update button; the list
stays usable while stale and nothing writes until the button is tapped. Board pin
**SB1: A (amber)** signed off. **Milestone 9 (Resilience) shipped** (2026-07-05, PR #33
`8f1cd46`): route-level `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx`
boundaries, a recipe-detail 404, a `toAuthErrorMessage` mapper, and a 17-site
raw-error sweep through `toErrorMessage`. Milestones 0–8 are all done.
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

- **In flight (not on `main`):** nothing. `codex/password-reset` merged as
  PR #37 and was deleted local+remote; the local
  `codex/password-reset-prerebase` backup ref is now obsolete (safe to prune).
  Working tree clean, local `main` = `origin/main`.
- **`main`:** at `7e66dd5` (**PR #37, Milestone 11 password reset** — merge of
  `codex/password-reset`: `391ebe1` feat (`components/auth-gate.tsx`
  forgot-password link + `requestPasswordReset`,
  `app/reset-password/{page,layout}.tsx`, `.auth-links` in `app/globals.css`) ·
  `e2b7ea5` test (the four `scripts/review-board/*reset*.mjs`) ·
  `b92db61`/`6482a5e`/`8abb9b3` docs · `88a7a53` skills-symlink chore ·
  `7f95c39` gate record; deployed to Vercel prod, `/reset-password` 200 live,
  owner iPhone reset pass confirmed 2026-07-11) atop `6fb32b2` (**PR #36,
  post-use UX fixes** — merge of
  `codex/ux-feedback-fixes`: `97e6c57` feat + `1a62a9b` docs wrap) atop `cc1e6ec` (**docs wrap of
  M10 PR 2**) atop `1d16ef8` (**Milestone 10 PR 2 (optimistic writes), PR #35** — merge of `codex/optimistic-writes`: item-level mutations in `lib/hooks/use-grocery-list.ts`, `use-plan.ts`, and `use-recipes.ts` made optimistic with targeted per-item rollback, plan/recipe form saves dropped their blocking refetches, new `scripts/review-board/verify-optimistic-pass.mjs` latency probe; this merge also carried the docs-wrap `7a0df26` from PR 1; deployed to Vercel prod, `/grocery`+`/plans`+`/recipes` 200 live) atop `41fa28b` (**Milestone 10 PR 1 (Shop stale banner), PR #34** — merge of `codex/shop-stale-banner`: replaced the silent regenerate-on-load in `lib/hooks/use-grocery-list.ts` with a `stale` flag + amber `.shop-stale-banner`/`.shop-stale-btn` in `app/grocery/page.tsx` (token-only, SB1: A); added `scripts/review-board/verify-shop-pass.mjs` (22 assertions) + the SB1 board capture/gen tooling; deployed to Vercel prod, `/grocery` 200 live) atop `8f1cd46` (**Milestone 9 (Resilience), PR #33** — merge of `codex/error-boundaries`: root `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` boundaries, a recipe-detail 404 via render-time `notFound()`, the `toAuthErrorMessage` mapper, and the 17-site raw-error sweep; deployed to Vercel prod, `/nonexistent` → 404 branded panel confirmed live) atop `3dcf791` (**docs wrap of the tags-cap hotfix, PR #32** — merge of `codex/docs-import-hotfix`, docs-only) atop `cbb1c57` (**import tags-cap hotfix, PR #31** — `codex/fix-import-tags-cap`: raised the request-schema `tags` cap 50→500 and added the `conflicting_source` error code so validation failures stop reading as "(not both)"; server-only, deployed) atop `88a6bc5` (**Recipe Import PR 2 / Phase C** — merge of `codex/import-ui` (PR #29): the in-app import UI — `components/recipe-import.tsx`, `lib/hooks/use-import.ts` + `draft-to-form.ts`, the shared `saveRecipeForm` seam, token-only import CSS; deployed to Vercel prod, `/recipes` import flow live; the same PR also carried the PR-1 docs-wrap `9601b1f`) atop `11834f9` (**Recipe Import PR 1** — `codex/import-api`: the app's first server-side route `POST /api/import-recipe` + `lib/import/*`, additive and inert), `45d5260` (recipe-import spec) and the iPad-coherence merges — the full
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
  longer lints (`eslint.ignoreDuringBuilds`). Thirty-plus PRs merged (through
  PR #37, 2026-07-11) plus several
  direct-to-main follow-up merges; CI has been green (one transient
  `supabase start` port-bind flake on `main` — `54322 already in use` — cleared
  by a job rerun, not a repo issue).
  `actions/checkout` and `actions/setup-node` are now on `@v5` (2026-07-03,
  merge `2e8bc09`), clearing the Node-20 runtime deprecation;
  `supabase/setup-cli@v1` stays (no v5) and `node-version: 20` is unchanged.
- **Latest verification:** 2026-07-11 (Milestone 11 ship): onboard baseline
  eslint / tsc clean, **vitest 138/138**; PR #37 CI green (app-checks 58s,
  db-tests 1m10s; DB layer untouched, pgTAP unchanged at 108), **`main`
  post-merge CI green on the first run (1m7s)**; prod liveness `/` 200,
  `/reset-password` 200, `/nonexistent` 404 (M9 boundary intact); the owner
  completed a live prod password reset on iPhone Safari the same day.
  (`verify-reset-pass` 25/25 was last run 2026-07-06 on the local stack — not
  re-run this session since the stack is down; the flow was instead proven
  live in prod.) Prior — 2026-07-05 (Milestone 10 PR 2, PR #35): eslint / tsc
  clean, **vitest 138/138** (unchanged — the change is hook/UI behavior with
  Playwright harnesses, not vitest units), `next build` 12 routes; new
  **`verify-optimistic-pass.mjs` 16/16, 0 console errors** on the local stack
  (self-contained OPTVERIFY seed/teardown): a grocery check and a plan remove
  each render <200ms under a 1500ms-delayed network (observed ~28-29ms) and both
  roll back + surface the red `.error-text` on `route.abort`. Regression
  harnesses re-run green after the senior-review fixes: **verify-shop 22/22**,
  **verify-recipes 22/22**, **verify-import 26/26** (the reduced-latency saves
  still round-trip; M4 state preservation holds). PR #35 CI green (app-checks +
  db-tests); **`main` post-merge CI green on the first run** (no port-bind flake).
  Prod liveness `/`, `/grocery`, `/plans`, `/recipes` all 200; `/nonexistent` 404
  (M9 boundary intact). DB layer untouched (pgTAP unchanged at 108). Prior —
  2026-07-05 (Milestone 10 PR 1, PR #34): eslint / tsc
  clean, **vitest 138/138** (unchanged — the change is UI/hook behavior with a
  Playwright harness, not vitest units), `next build` 12 routes; new
  **`verify-shop-pass.mjs` 22/22, 0 console errors** on the local stack
  (self-contained: seeds + tears down its own isolated plan/recipes) — proves no
  `regenerate_grocery_list` RPC fires on load, correct "Generate list" →
  "Update list" banner states, and that two checked items survive a
  plan-triggered Update (M4 state preservation, now user-initiated). PR #34 CI
  green (app-checks 51s, db-tests 1m9s); **`main` post-merge CI FAILED first
  run** — the db-tests job died at "Start local Supabase stack" with `failed to
  bind host port for 0.0.0.0:54322 ... address already in use` (the documented
  transient port-bind flake; app-checks passed, pgTAP never ran, our PR touches
  zero DB/schema) — **cleared by a `gh run rerun --failed`, second run green**.
  Prod liveness `/grocery` 200 + `/` 200. DB layer untouched (pgTAP unchanged at
  108). Prior — 2026-07-05 (Milestone 9 (Resilience), PR #33):
  eslint / tsc clean, **vitest 138/138** (128 + 10 new `lib/errors.test.ts`),
  `next build` 12 routes; review-board harnesses on the local stack —
  **verify-detail-pass 15/15**, **verify-recipes-pass 22/22** (live `save_recipe`
  round-trip), **verify-import-pass 26/26**; boundary/not-found/auth probes green
  (error panel renders + recovers; unmatched route + bad recipe id `PGRST116` →
  not-found panel; wrong password → "Wrong email or password."); grep proof no
  `setError(x.message)` sites remain. PR #33 CI green (app-checks 56s, db-tests
  1m5s), **`main` post-merge CI green (1m19s)**, prod deploy live (`/` 200,
  `/nonexistent` 404 with `error-boundary-panel`). DB layer untouched (pgTAP
  unchanged at 108). Prior — 2026-07-04 (import tags-cap hotfix, PR #31): eslint /
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

- **Just done (2026-07-11):** **Milestone 11 (password reset) shipped end to
  end.** Onboard found two drift items — the branch carried five commits (not
  the documented three; the 2026-07-11 doc de-rot pair had landed on it) and
  the tracked onboard/wrap skill files had been swapped, uncommitted, for
  symlinks into `~/Dev/claude-skills/sites/meal-queue/` — both resolved in
  chore `88a7a53`. The owner signed off **AR2: A** (the last open board pin)
  and configured the Supabase-dashboard redirect URLs + Site URL; gates
  recorded in docs commit `7f95c39`. Pushed as `mitchthompson`, opened
  **PR #37**, CI green first try (app-checks 58s, db-tests 1m10s), merged to
  `main` `7e66dd5` (merge commit; branch deleted local+remote), `main`
  post-merge CI green on the first run (1m7s), Vercel deploy live (`/` 200,
  `/reset-password` 200, `/nonexistent` 404). **The owner then completed the
  prod real-device pass: a live reset round-trip on iPhone Safari, confirmed
  working.** M11 closed; the auth-flow flag moved to Resolved (only the
  indefinitely-deferred sign-up-confirmation third remains, by owner
  decision). Zero schema, zero deps.
- **Prior (2026-07-08):** **Post-use UX fixes shipped & deployed** on
  `codex/ux-feedback-fixes` (off `main` `cc1e6ec`). Three issues the owner hit in
  real use, spec at [plans/ux-feedback-fixes.md](plans/ux-feedback-fixes.md):
  (1) Today CTAs deep-link to the right plan (`?plan=<id>`) or the create sheet
  (`?new=1`) instead of a bare `/plans`; (2) adding a meal opens a **full-screen
  takeover** (`components/plan-add-meal.tsx`) instead of the inline quick-add that
  fought the iOS keyboard — reuses the same `usePlan` quick-add state machine;
  (3) "Generate grocery list" → **"Shop this plan"**, deep-linking
  `/grocery?plan=<id>` (generation stays on the Shop banner). An adversarial
  review (5 lenses, refute-verified) found + fixed 4 edge/a11y issues (a `?new=1`
  create-sheet flicker, a past-plan "Shop this plan" misfire, no takeover focus
  trap, focus not restored on close). Gate green (tsc, vitest 138/138, eslint
  `--max-warnings=0`, `next build` 12 routes) + a real-app pass (12 shots, 0
  console errors). Owner signed off the review board (artifact 🛠️) → merged to
  `main` & deployed. Zero schema, zero deps. **Owner tail:** a real-iPhone pass on
  the takeover (WebKit ≠ Playwright). Review-board capture scripts + seed live in
  the session scratchpad (not committed).
- **Prior (2026-07-06):** **Milestone 11 (password reset) built on
  `codex/password-reset` (off `main` `cc1e6ec`; since committed as
  `391ebe1`/`e2b7ea5`/`b92db61` and rebased onto `6fb32b2` — unpushed,
  unmerged).** Owner
  approved starting M11. Built per [plans/password-reset.md](plans/password-reset.md):
  the "Forgot password?" link + `requestPasswordReset` in `components/auth-gate.tsx`,
  and `app/reset-password/page.tsx` + `layout.tsx`. Senior `/code-review` (high)
  found no correctness bugs; 3 owner-approved notes applied (`disabled={busy}` on
  the forgot button, status-line clears on the sign-in↔sign-up toggle, title case
  "Reset Password"). Board round **AR** (redeployed in place to the 🍳 artifact)
  caught a real sign-in link collision → **owner picked AR1: A (stacked)**, shipped
  as the `.auth-links` wrapper in `app/globals.css` (documented in
  [design-system.md](design-system.md)). Verified: vitest 138/138, `next build`
  13 routes, new `scripts/review-board/verify-reset-pass.mjs` **25/25** (real
  Mailpit recovery-email round-trip; the harness restores the reviewer password
  and self-heals). Zero schema, zero deps. **Still open (owner-side):** AR2
  sign-off, the Supabase-dashboard redirect URLs, and a prod real-device pass —
  then push/PR/merge. Also pushed the stranded M10-PR2 docs wrap `cc1e6ec` to
  `origin/main` (was local-only).
- **Prior (2026-07-05):** **Milestone 10 PR 2 (optimistic writes) shipped &
  deployed.** PR #35 (`codex/optimistic-writes` → `main` `1d16ef8`, branch
  deleted local+remote): item-level mutations patch local state before the
  network write and roll back only the touched item on failure —
  `use-grocery-list.ts` (`toggleChecked`/`setCheckedForBucket`/`movePantryToMain`/
  `setOnHand`), `use-plan.ts` (`adjustServing`/`removeItem`/`addMeal`; keep
  `refreshPlansAndKeepSelection`, drop `loadPlanItems`; `addMeal` appends a
  temp-id row swapped for the real id on insert), `use-recipes.ts`
  (`saveRecipe`/`deleteRecipe` local list patch, atomic RPC await kept).
  Senior `/code-review` (high) found + fixed 3 issues: (1) a refresh-after-write
  rollback regression — a committed write followed by a `refreshPlansAndKeepSelection`
  throw rolled back the persisted change; fixed with `written`/`deleted` guards
  (and the tempId filter for `addMeal`) so only a WRITE failure reverts; (2) a
  concurrent stale-snapshot clobber — owner chose to **harden to targeted
  functional rollback** (restore only the touched item, never a whole-list
  snapshot); (3) a same-millisecond temp-id collision — fixed with a random
  suffix. `verify-optimistic-pass.mjs` 16/16, all regression harnesses green,
  gate green, deployed. Zero schema, zero deps, no board pin (no visual surface).
  This merge also carried the docs-wrap `7a0df26` from PR 1 (last session's wrap
  that had not reached `origin/main`), so tracking is back in sync.
- **Prior (2026-07-05):** **Milestone 10 PR 1 (Shop stale banner) shipped &
  deployed.** PR #34 (`codex/shop-stale-banner` → `main` `41fa28b`, branch
  deleted local+remote): replaced the silent regenerate-on-load in
  `lib/hooks/use-grocery-list.ts` (`loadGroceryItems`) with a `stale` flag; the
  Shop page renders an amber `.shop-stale-banner` + explicit Generate/Update
  button (SB1: A), list stays usable while stale, nothing writes until the
  button. Senior `/code-review` (high) caught + fixed one regression the banner
  introduced — on a plan switch it briefly showed the *previous* plan's
  staleness/copy because `loadGroceryItems` is async and never toggles
  `loading`; fixed by resetting `setStale(false)` at the top of the load.
  `verify-shop-pass.mjs` 22/22, gate green, deployed. Zero schema, zero deps.
  Board redeployed in place to the existing artifact URL (🍳) with the SB1 pin;
  owner verdict **A (amber)**.
- **Prior (2026-07-05):** **Milestone 9 (Resilience) shipped & deployed.**
  PR #33 (`codex/error-boundaries` → `main` `8f1cd46`, branch deleted): root
  `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` boundaries
  (standalone, outside `AppShell` since a crash may be in the shell), a
  recipe-detail 404 (`PGRST116` → a `missing` state flag → render-time
  `notFound()`; an async-thrown `notFound()` is **not** caught by the boundary,
  verified against the Next.js docs, so the flag pattern is deliberate), a
  `toAuthErrorMessage` mapper (maps common auth errors, passes other readable
  ones through like `toErrorMessage`), and the 17-site raw-`setError(x.message)`
  sweep. Board pin EB1 (error panel) signed off; senior `/code-review` clean,
  3 follow-ups applied in `fae30a6` (global-error logging, panel `margin:0 auto`
  centering, auth pass-through). vitest **138/138**, verify harnesses 15/22/26,
  prod 404 panel live. Zero schema, zero deps. (Earlier the same day, docs-only:
  milestones 9-15 scoped into builder-ready specs — see progress-log.)
- **Next action: await the owner's pick from M12–M15** (see
  [roadmap.md](roadmap.md) Scoped Milestones; recommended order 12 → 13 → 14 →
  15). Each milestone needs its own explicit owner go-ahead before any code.
  For whoever picks up: run `/onboard`, then open the chosen builder-ready spec
  in `docs/plans/` and follow it —
  M12 grocery unit-merge ([plans/unit-merge.md](plans/unit-merge.md), branch
  `codex/grocery-unit-merge`, **the one DB milestone**: fifth migration, full
  backup → preflight → apply → verify ritual, migration before dependent
  client merge); M13 plan copy ([plans/plan-copy.md](plans/plan-copy.md),
  branch `codex/plan-copy`, touches `createPlan`); M14 dark mode
  ([plans/dark-mode.md](plans/dark-mode.md), needs its own board round for the
  dark token VALUES); M15 empty states
  ([plans/empty-states.md](plans/empty-states.md), last). Nothing is in
  flight; the tree is clean.
  - **Reset-harness re-drive runbook** (only if `/reset-password` ever needs
    local re-verification): stack up **with mailpit**
    (`supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,supavisor`
    — no mailpit exclude); `rm -rf .next`; start dev via `rtk proxy bash -c '…exec
    npx next dev -p 3123'` with the local `NEXT_PUBLIC_SUPABASE_*` inline; then
    `node scripts/review-board/verify-reset-pass.mjs`.
- **Prior (2026-07-04):** **Recipe Import PR 2 / Phase C — merged & deployed.** PR #29
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
- **Still open, owner-run (not an agent task):** the **Needs-Mitchell
  real-device import pass** — on `npm run dev:phone`, iPhone standalone (never
  prod), one open-site URL import, the paywall-redirect path, and
  keyboard-over-textarea + safe-area under the teal save bar (Playwright
  WebKit ≠ real Safari; the NYT paste path is already owner-confirmed live).
- **Blockers:** none. M11 is fully closed (merged, deployed, owner prod
  device pass done, all 2026-07-11). M12–M15 wait on the owner's pick.
- **Environment notes:** the working branch is **`main`**, in sync with
  `origin/main` at `7e66dd5` (PR #37). `codex/password-reset` is merged and
  deleted (local+remote); the local `codex/password-reset-prerebase` backup
  ref is obsolete (prune at will). The Supabase-dashboard redirect URLs for
  `/reset-password` (prod + `localhost:3000`) are configured (owner,
  2026-07-11). Many older
  merged `codex/*` feature branches remain locally (harmless refs — prune with
  `git branch --delete` if desired). `.env.local` includes
  `ANTHROPIC_API_KEY` (sk-ant-, present locally); **Vercel has `ANTHROPIC_API_KEY`
  set for Production + Preview** (owner-provisioned). The local-pointed dev server
  (`:3123`) used for the M11 reset harness/board capture was stopped at this wrap;
  the final `next build` poisoned `.next` with `.env.local`'s prod URLs (the
  documented gotcha) — `rm -rf .next` before re-driving any local harness.
  **Pushing as the repo owner:** the active machine account is `2a-webteam`
  (gets a 403 on push to this repo); push/PR as `mitchthompson` — `gh` commands
  via `GH_TOKEN=$(gh auth token --user mitchthompson)`, and `git push` via a
  one-off `https://x-access-token:$(gh auth token --user mitchthompson)@github.com/...`
  URL (don't persist it; re-`fetch` origin after so `origin/main` tracking updates).
  **Gotcha (bit the M9 EB1 capture):** running `next build` while a local dev
  server is up poisons the shared `.next` with `.env.local`'s prod Supabase URLs
  — `rm -rf .next` and restart the dev server before re-driving it (review-board
  README documents this).
  **Key rotation:** the raw key value was briefly exposed in a session transcript
  (IDE selection) — rotation was recommended but the owner chose to **leave it
  as-is for now**; rotate if that changes (Console → API Keys → revoke
  `meal-queue-vercel` → recreate → update `.env.local` + Vercel). `.env.local`
  prod DB access verified (PG 17.6); read-only Supabase MCP configured in
  `.mcp.json` (owner OAuth pending first use); `gh` holds both accounts
  (`2a-webteam` active machine-wide, `mitchthompson` pinned per command via
  `GH_TOKEN=$(gh auth token --user mitchthompson)`); local Supabase stack runs
  on Colima. **Found DOWN on 2026-07-11 (the Colima/Docker daemon is not
  running)** — the stack had been left up on 2026-07-06 running WITH mailpit.
  To re-drive the reset harness, start it via
  `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,supavisor`
  (mailpit **not** excluded — reset-email testing needs the mail catcher; the
  standard start command lists `mailpit` in the excludes).
  Reviewer account (`reviewer@local.test`) password was changed and
  restored to `review-pass-1234` by the reset harness. Verify with `supabase
  status` before relying on it; local DB already seeded with the review-board
  reviewer + recipes; the harnesses seed/tear down their own isolated data.

## Page status

Routes confirmed against `app/`. Per-page intent lives in `docs/pages/<slug>.md`
([settings](pages/settings.md) and [recipes](pages/recipes.md) are current;
the other three are stubs the redesign brief supersedes).

| Page | Route | Status |
| --- | --- | --- |
| Today | `/` (`app/page.tsx`) | Working — reflow home screen ("Tonight" hero shows up to two meals + "Also tonight", deadline strip, week peek without meal-type sublabels, nudge); CTAs deep-link to the intended plan (`/plans?plan=<id>`) or the create sheet (`/plans?new=1`) instead of a bare `/plans` (2026-07-08); data layer in `lib/hooks/use-today.ts` |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working — v2 pass shipped (PR #21): page title + card labels, teal links, 44px targets, full-width save, serves line + sample-data seeder removed; atomic `save_recipe` RPC live; mobile editor takeover (PR #17); **in-app import shipped (PR #29): Import button + `?import=1` → paste/URL → LLM parse → review screen → save via the shared `saveRecipeForm`** (`components/recipe-import.tsx`, `lib/hooks/use-import.ts`); save/delete patch the list locally instead of a full reload (M10 PR 2, PR #35); data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working — v2 pass shipped (PR #22): flat hairline rows, full-width teal "Start cooking" (launches `components/cook-mode.tsx`), breadcrumb + one-row actions, pantry-badge quirk fixed; a bad id now renders the not-found boundary (M9, PR #33) |
| Plan | `/plans` (`app/plans/page.tsx`) | Working — flat day lists (no lunch/dinner division, PR #18; `meal_type` vestigial); adding a meal opens a **full-screen takeover** (`components/plan-add-meal.tsx`, 2026-07-08 — replaced the inline quick-add that fought the iOS keyboard; same recents-first search + Enter/Shift+Enter, all three modes); reads `?plan`/`?new` deep links; "Shop this plan" exit; day items in `components/plan-day-items.tsx`; item writes (serving/add/remove) are optimistic with per-item rollback (M10 PR 2, PR #35); data layer in `lib/hooks/use-plan.ts` |
| Shop | `/grocery` (`app/grocery/page.tsx`) | Working — reflow chunky direction (pinned order bar, 30px checks, sticky sections); transactional state-preserving regeneration underneath; **no longer regenerates on load — a stale plan shows an amber banner + explicit Generate/Update button (M10 PR 1, PR #34, SB1: A)**; reads `?plan=<id>` to land on a specific plan (from the plan screen's "Shop this plan", 2026-07-08); item writes (check/pantry/on-hand) are optimistic with per-item rollback (M10 PR 2, PR #35); data layer in `lib/hooks/use-grocery-list.ts` |
| Settings | `/settings` (`app/settings/page.tsx`) | Working — v2 pass shipped (PR #20): iOS-style rows, page title + card labels, 44px targets, full-width teal save; `ensureUserSettings` runs once per sign-in; settings defaults now share one `DEFAULT_USER_SETTINGS` source of truth mirroring SQL (2026-07-03) |
| Reset password | `/reset-password` (`app/reset-password/page.tsx`) | Working — M11 (PR #37, 2026-07-11): recovery-session form (loading / expired-link / new-password states) reached from the reset email; gates on session presence; no `docs/pages/` stub — intent lives in [plans/password-reset.md](plans/password-reset.md) |

Authentication is email/password through Supabase, with a self-serve password
reset (M11; the reset email opens in the default browser, not the installed
standalone app — accepted constraint). The app installs to the
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
| 9 | Resilience (error/loading/not-found boundaries + raw-error sweep) | **Done (2026-07-05)** — PR #33 (`codex/error-boundaries` → `main` `8f1cd46`): root boundaries, recipe-detail 404, `toAuthErrorMessage`, 17-site sweep; EB1 signed off, vitest 138/138, deployed. Spec: [plans/error-boundaries.md](plans/error-boundaries.md) |
| 10 | Responsiveness (Shop stale banner + optimistic writes) | **Done (2026-07-05)** — PR #34 (`41fa28b`): amber staleness banner replaces silent regen-on-load, SB1: A, `verify-shop-pass` 22/22; **PR #35 (`codex/optimistic-writes` → `main` `1d16ef8`): optimistic item mutations with targeted per-item rollback, form saves shed blocking refetches, senior review fixed 3 issues, `verify-optimistic-pass` 16/16**. Both deployed; closes the "no optimistic UI" flag. Spec: [plans/responsiveness.md](plans/responsiveness.md) |
| 11 | Password reset | **Done (2026-07-11)** — PR #37 (`codex/password-reset` → `main` `7e66dd5`), deployed: forgot-password link + `requestPasswordReset` in `auth-gate.tsx`, new `/reset-password` route. Senior review clean, board **AR1: A + AR2: A**, `verify-reset-pass` 25/25, Supabase redirect URLs configured, **owner prod iPhone reset pass confirmed**. [plans/password-reset.md](plans/password-reset.md) |
| 12-15 | Scoped batch (2026-07-05): unit merge (DB), plan copy, dark mode, empty states | **Specced, not started** — four builder-ready specs in `docs/plans/`; owner picks order and gives per-milestone go-aheads. [roadmap.md](roadmap.md) Scoped Milestones |

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
- Tests: vitest for `lib/` domain logic (138 across 9 files); pgTAP for the
  database layer (108 across three suites) on an ephemeral local/CI stack.
- `supabase/schema.sql` canonical; forward-only migrations in
  `supabase/migrations/`; prod applies by hand (runbook: backup → preflight →
  apply → verify → rolled-back smoke), **migration before dependent client
  merge**.

## Open issues

- Round-1 review-board pins signed off 2026-07-03 (all defaults kept, no code
  changes); C2 (mark-cooked no-op) can still be revisited as a schema change
  if a consumer appears — see [design-flags.md](design-flags.md).
- ~~No route-level `error.tsx` / `loading.tsx` boundaries; unmapped errors still
  surface raw messages.~~ **Resolved 2026-07-05 (milestone 9, PR #33):** root
  `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` boundaries, a
  recipe-detail 404, and 17 raw `setError(x.message)` sites swept through
  `toErrorMessage`/`toAuthErrorMessage`. See [design-flags.md](design-flags.md).
- ~~Shop silently regenerates the grocery list on load (illegible; the list
  changes with no explanation).~~ **Resolved 2026-07-05 (milestone 10 PR 1, PR
  #34):** a stale plan now shows an amber banner + explicit Generate/Update
  button; nothing regenerates on load. Closes the "silent regeneration" half of
  the over-triggered-regeneration flag (the version-scoping half was closed by
  milestone 3). See [design-flags.md](design-flags.md).
- ~~M10 PR 2 (optimistic writes) is the remaining half of the "no optimistic UI"
  flag — not started.~~ **Resolved 2026-07-05 (milestone 10 PR 2, PR #35
  `1d16ef8`):** item-level mutations are optimistic with targeted per-item
  rollback and the form saves shed their blocking refetches; the "no optimistic
  UI" flag is now fully closed. See [design-flags.md](design-flags.md) (Resolved).
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
