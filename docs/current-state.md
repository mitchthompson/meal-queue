# Current State

Last reviewed: 2026-10-02 (**Onboard after an 83-day gap, a security patch, and a re-plan.** Onboard found `npm audit` regressed to 8 findings (1 critical in `next` 15.5.19) and the local stack down; git, PR, and CI state matched the docs and the baseline was green. **PR #40** (`codex/deps-security` → `main` `0dcabab`) shipped the in-range `npm audit fix` plus the postcss override 8.5.10 → 8.5.28: `npm audit` 8 → 0, CI green on the PR and post-merge `main`, prod 200. An owner interview then reset the queue to **17 → 18 → 19 → 14** (weekday suggestions, amounts in steps + retire cook mode, Node upkeep, dark mode); M13 and M15 dropped, M16 superseded. Specs [plans/weekday-suggestions.md](plans/weekday-suggestions.md) and [plans/amounts-in-steps.md](plans/amounts-in-steps.md) written and fork-locked (F1 a, F2 a, W1 a). Prior: 2026-07-11 night, Milestone 12 shipped (PR #39, fifth migration applied to prod); full history in [progress-log.md](progress-log.md).)

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**Re-plan after real use (2026-10-02).** First session after an 83-day gap: a
dependency security patch shipped (PR #40, `main` `0dcabab`, `npm audit` 8 → 0),
then an owner interview reshaped the queue. New order **17 → 18 → 19 → 14**:
M17 weekday suggestions + Add the usuals
([plans/weekday-suggestions.md](plans/weekday-suggestions.md)), M18 amounts in the
steps + retire cook mode ([plans/amounts-in-steps.md](plans/amounts-in-steps.md)),
M19 Node upkeep, then M14 dark mode. M13 (plan copy) and M15 (empty states)
were dropped and M16 (step-ingredient link) superseded by M18; see
[roadmap.md](roadmap.md) Re-plan and [decisions.md](decisions.md). Both new specs
are builder-ready (forks answered). Nothing is in flight; M17 waits on the
owner's build go-ahead.

**Milestone 12 (grocery unit merge) is complete — PR #39
(`codex/grocery-unit-merge` → `main` `257a836`) merged 2026-07-11 and the
fifth migration applied to prod the same evening.** Built from
[plans/unit-merge.md](plans/unit-merge.md): `units.base_factor numeric(12,6)`
(exact US-customary factors, data-driven) + a rewritten
`regenerate_grocery_list` — buckets key on `name|vol/wt/code|flag`, sum in
base units (ml/g), display in the largest contributing unit at 3 decimals;
count units never merge across codes; pantry classification still separates;
old-key rows migrate in place with `bool_and` collapse for collisions. Same
signature/security/lock/phases as M4. New pgTAP suite: 33 assertions, all 11
spec cases (suite total **141**). Prod ritual complete (backup → preflight →
apply → verify → rolled-back smoke; details in
[progress-log.md](progress-log.md)). Zero client changes, zero deps.
Milestones 0–12 are complete (below).

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
database layer is atomic, race-free, and state-preserving (141 pgTAP
assertions in CI since M12), with data layers in `lib/hooks/`. The redesign
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

- **In flight (not on `main`):** nothing. `codex/deps-security` merged as
  PR #40 and was deleted local+remote. Stale local refs remain (harmless,
  prune at will): `codex/grocery-unit-merge` (PR #39; its remote is gone but
  the local ref survived, contrary to the 2026-07-11 wrap),
  `codex/password-reset-prerebase`, and about twenty older merged `codex/*`
  branches. Local `main` = `origin/main`.
- **`main`:** at `0dcabab` (**PR #40, dependency security patch** — merge of
  `codex/deps-security`: `436e82a` chore(deps), the in-range `npm audit fix`
  (next 15.5.19 → 15.5.27) plus the postcss override 8.5.10 → 8.5.28;
  `npm audit` 8 → 0; deployed, `/`+`/grocery`+`/recipes`+`/plans` 200) atop
  `ed0ba50` (docs wrap of PR #39) atop `257a836` (**PR #39, Milestone 12 grocery unit merge** —
  merge of `codex/grocery-unit-merge`: `8eb9eb4` feat — migration
  `20260711225000_grocery_unit_merge.sql` (`units.base_factor` + the
  dimension-aware `regenerate_grocery_list` rewrite), `supabase/schema.sql`
  updated, CI baseline regenerated · `b7cb5dd` test —
  `supabase/tests/grocery_unit_merge_test.sql` (33 assertions, pgTAP total
  141); migration hand-applied to prod 2026-07-11 with the full ritual;
  deployed, `/`+`/grocery`+`/recipes` 200) atop `b566822` (docs wrap of
  PR #38) atop `be3fa74` (**PR #38, cook-feedback fixes** — merge of
  `codex/cook-display-fixes`: `f13c9fb` fix — zero amounts render "to taste"
  via `formatIngredientAmount` in `lib/grocery.ts`, used by
  `app/recipes/[id]/page.tsx` (detail list + cook-mode chips) and
  `app/grocery/page.tsx` · `a486af9` fix — import prompt keeps source step
  boundaries · `674c1d3` docs — candidate-M16 spec
  [plans/step-ingredients.md](plans/step-ingredients.md) + roadmap/design-flags/
  unit-merge true-ups; deployed to Vercel prod, `/`+`/grocery`+`/recipes` 200)
  atop `7e66dd5` (**PR #37, Milestone 11 password reset** — merge of
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
- **Prod database:** all five migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation, grocery unit merge — the fifth applied
  2026-07-11 with backup `~/meal-queue-backup-2026-07-11-1633.dump`, preflight,
  and a rolled-back live smoke). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only. schema.sql was consolidated
  2026-07-03 (historical inline `ALTER`s folded into the base DDL, 735 → 699
  lines) — proven effect-identical by a fresh-build `pg_dump` diff, so prod is
  unaffected.
- **CI:** GitHub Actions on every PR — app checks (**lint** / typecheck /
  vitest / build) and DB tests (ephemeral Supabase stack, 141 pgTAP assertions
  across four suites), CLI pinned 2.109.0, NOTESTS guard. The db-tests job
  also guards baseline drift — a "Baseline schema matches schema.sql" step runs
  before `supabase start` and fails if the baseline migration and `schema.sql`
  diverge (2026-07-03). Lint runs
  `eslint . --max-warnings=0` on the flat config (PR #23); `next build` no
  longer lints (`eslint.ignoreDuringBuilds`). Thirty-plus PRs merged (through
  PR #40, 2026-10-02) plus several
  direct-to-main follow-up merges; CI has been green (one transient
  `supabase start` port-bind flake on `main` — `54322 already in use` — cleared
  by a job rerun, not a repo issue).
  `actions/checkout` and `actions/setup-node` are now on `@v5` (2026-07-03,
  merge `2e8bc09`), clearing the Node-20 runtime deprecation;
  `supabase/setup-cli@v1` stays (no v5) and `node-version: 20` is unchanged.
  Node 20 reached end of life 2026-04-30 and the `@supabase/*` packages now
  declare Node ≥ 22 (CI prints engine warnings only); moving CI and Vercel to
  a current LTS is milestone 19.
- **Latest verification:** 2026-10-02 (security patch, PR #40): onboard
  baseline green (eslint / tsc / vitest 141/141); after the patch eslint clean,
  tsc clean, vitest 141/141, `next build` 13/13 static pages, `npm audit` 0
  (was 8: 1 critical, 5 high, 2 moderate); `npm ci --dry-run` on the new
  lockfile clean under npm 10 / Node 21 (closest local match to CI's Node 20);
  PR #40 CI green (app-checks 53s, db-tests 1m4s, Vercel preview built),
  **`main` post-merge CI green (1m9s)**; prod probes `/`, `/grocery`,
  `/recipes`, `/plans` all 200. DB layer untouched (pgTAP unchanged at 141).
  Prior — 2026-07-11 night (Milestone 12, PR #39): onboard
  baseline green (eslint / tsc / vitest 141/141) and pre-change pgTAP 108/108
  on the local stack; post-change fresh `supabase db reset` green (schema +
  baseline + all five migrations; re-apply proven idempotent), `supabase test
  db` **141/141** across four suites (first run caught `min(uuid)` — 42883,
  no such aggregate — fixed with `(array_agg(id order by id))[1]`, second run
  fully green); eslint / tsc / vitest 141/141 clean (app untouched); PR #39 CI
  green first try (app-checks 51s, db-tests 1m3s incl. the baseline drift
  guard), **`main` post-merge CI green on the first run**; prod probes `/`,
  `/grocery`, `/recipes` all 200. Prod apply verified live: 13/13 exact
  `base_factor`s, function body swapped (security invoker, grants intact),
  rolled-back smoke 52→52 rows / 28→28 checked / zero residue. Prior —
  2026-07-11 evening (cook-feedback fixes, PR #38):
  onboard baseline green (eslint / tsc / vitest 138/138), then post-change
  eslint clean, tsc clean, **vitest 141/141** (+2 `formatIngredientAmount`,
  +1 prompt step-boundary), `next build` 13 routes; PR #38 CI green first try
  (app-checks 56s, db-tests 1m3s; DB layer untouched, pgTAP unchanged at 108),
  **`main` post-merge CI green on the first run**; prod probes `/`, `/grocery`,
  `/recipes` all 200. Root cause confirmed against prod data (read-only psql:
  salt/pepper/crushed-red-pepper stored `0.000 tsp` on the One-Pot Chicken
  import; its steps stored as 16 rows vs ~5 in the source). Prior —
  2026-07-11 (Milestone 11 ship): onboard baseline
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
- **Backups:** manual `pg_dump` (libpq; custom format, stored outside the
  repo, 10-table manifest checked). The exact command is written out in
  [plans/amounts-in-steps.md](plans/amounts-in-steps.md) Phase 12 and is due in
  architecture.md. Latest snapshot: `~/meal-queue-backup-2026-07-11-1633.dump`
  (taken for the M12 apply).

## Active Handoff

- **Just done (2026-10-02):** onboard after an 83-day gap (drift: `npm audit`
  at 8 findings incl. 1 critical, the local stack down with Colima's docker
  context missing, a stale local `codex/grocery-unit-merge` ref), then
  **PR #40** (security patch, `main` `0dcabab`, `npm audit` 8 → 0, deployed),
  then the **re-plan** from an owner interview plus read-only prod queries
  (33 weeks of plans: Thursday chicken 31/31, Sunday beans 24/29; 0 of 185
  meals scaled): order 17 → 18 → 19 → 14, M13 and M15 dropped, M16
  superseded. Specs for M17 and M18 drafted, checked against the code, and
  fork-locked; the old M13/M15/M16 specs carry banners. No app-code change
  beyond the dependency patch; prod was only read.
- **Prior (2026-07-11, night):** **Milestone 12 (grocery unit merge)
  shipped end to end (PR #39 → `main` `257a836`; fifth migration applied to
  prod).** Owner picked the recommended order 12 → 13 → 14 → 15 and gave all
  gate words same-session. `units.base_factor` + the dimension-aware
  `regenerate_grocery_list` rewrite; pgTAP 108 → **141** (new 33-assertion
  suite); two recorded deviations (upsert also sets `unit_code`;
  `(array_agg(id order by id))[1]` for smallest-uuid). Prod ritual complete:
  backup `~/meal-queue-backup-2026-07-11-1633.dump` → preflight (8 rows / 6
  plans will merge, all uniform-state; 687 dormant pre-M4 v-prefixed keys
  noted, handled by the standing per-plan strip) → apply → verify → rolled-back
  smoke (52→52 rows, 28→28 checked, zero residue). Nothing user-visible
  changes until each plan's next Shop-banner regeneration. Zero client code,
  zero deps; `lib/grocery.ts` untouched. Branch deleted local+remote.
- **Prior (2026-07-11, evening):** **Cook-feedback fixes shipped end to
  end (PR #38 → `main` `be3fa74`, deployed).** The owner reported three issues
  mid-cook: (1) "0 tsp salt" in cook mode — the importer stores "to taste" as
  `amount: 0` by design, no display site knew; fixed with
  `formatIngredientAmount` ("to taste" when 0) across detail/cook/Shop.
  (2) ~5 source steps imported as 16 — fixed with a step-boundary rule in the
  import prompt (future imports only). (3) chips mismatching their step — the
  known heuristic flag; scoped as **candidate M16**
  ([plans/step-ingredients.md](plans/step-ingredients.md)); its §2 owner forks
  need an interview before build. **Owner follow-ups:** re-import One-Pot
  Chicken to get clean steps — but a recipe delete **cascades to
  `meal_plan_items`** (tonight's plan + history), so either delete after
  tonight and accept the history loss, or hand-edit the steps in the editor to
  keep the same recipe id; then the M16 interview when ready. (2026-10-02:
  M16 was superseded by M18, so no interview is needed; the One-Pot cleanup
  moved to Still open below.)
- **Earlier sessions (2026-07-04 → 2026-07-11):** see
  [progress-log.md](progress-log.md).
- **Next action: Milestone 17, weekday suggestions + Add the usuals, waits on
  the owner's build go-ahead.** On the go: from a clean `main`, follow
  [plans/weekday-suggestions.md](plans/weekday-suggestions.md) from Phase 0 on
  branch `codex/weekday-suggestions` (Phase 0 also repairs the two
  date-rotted plan harnesses). STOP ① is the WS1-WS4 board round, published
  as a NEW review artifact (a distinct review under the board-URL rule); no UI
  code before its verdicts. Forks F1/F2 are answered (both (a)). After M17:
  M18 ([plans/amounts-in-steps.md](plans/amounts-in-steps.md): two PRs plus an
  owner-gated prod backfill; W1 answered, no wake lock), then M19 (Node
  upkeep; spec when picked), then M14 (dark mode). Each milestone needs its
  own go-ahead before code. The local stack is down: `colima start`, then
  `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`.
  - **Reset-harness re-drive runbook** (only if `/reset-password` ever needs
    local re-verification): stack up **with mailpit**
    (`supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,supavisor`
    — no mailpit exclude); `rm -rf .next`; start dev via `rtk proxy bash -c '…exec
    npx next dev -p 3123'` with the local `NEXT_PUBLIC_SUPABASE_*` inline; then
    `node scripts/review-board/verify-reset-pass.mjs`.
- **Still open, owner-run (not an agent task):** the **Needs-Mitchell
  real-device import pass** — on `npm run dev:phone`, iPhone standalone (never
  prod), one open-site URL import, the paywall-redirect path, and
  keyboard-over-textarea + safe-area under the teal save bar (Playwright
  WebKit ≠ real Safari; the NYT paste path is already owner-confirmed live).
  Also, if not done since July: clean up One-Pot Chicken's 16 split steps by
  hand-editing them (re-importing means deleting the recipe, which cascades
  to its plan history), and tap the Shop banner's Update on a current plan
  once to eyeball M12's merged units on real data.
- **Blockers:** none. M17 waits only on the owner's build go-ahead.
- **Environment notes:** **open Claude Code at the repo root**
  (`~/Dev/meal-queue/meal-queue`), not its parent folder: from the parent,
  `/onboard` and `/wrap` never appear in the slash menu, and the repo's
  `CLAUDE.md`, `.mcp.json` (read-only Supabase MCP), and
  `.claude/settings.local.json` don't load (found 2026-10-02). The working
  branch is **`main`** at `0dcabab` (PR #40) plus the 2026-10-02 docs commit;
  stale local refs are listed under Stable Baseline.
  A fresh prod backup exists at `~/meal-queue-backup-2026-07-11-1633.dump`
  (424K, taken for the M12 apply). The Supabase-dashboard redirect URLs for
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
  on Colima. **Found DOWN on 2026-10-02:** Colima was stopped and its
  `colima` docker context was missing (`colima start` recreates it, then the
  standard `supabase start -x ...`). The local DB was last left at the fresh
  post-M12 state (`supabase db reset` ran, so review-board seed data was
  wiped; the harnesses seed their own). To re-drive the reset harness,
  start the stack via
  `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,supavisor`
  (mailpit **not** excluded — reset-email testing needs the mail catcher; the
  standard start command lists `mailpit` in the excludes).
  The review-board reviewer account (`reviewer@local.test` /
  `review-pass-1234`) and its recipes were **wiped by the M12 `supabase db
  reset`** — re-seed before the next board/harness session (the harnesses
  seed/tear down their own isolated data, but the reviewer login itself must
  exist). Verify with `supabase status` before relying on the stack.

## Page status

Routes confirmed against `app/`. Per-page intent lives in `docs/pages/<slug>.md`
([settings](pages/settings.md) and [recipes](pages/recipes.md) are current;
the other three are stubs the redesign brief supersedes).

| Page | Route | Status |
| --- | --- | --- |
| Today | `/` (`app/page.tsx`) | Working — reflow home screen ("Tonight" hero shows up to two meals + "Also tonight", deadline strip, week peek without meal-type sublabels, nudge); CTAs deep-link to the intended plan (`/plans?plan=<id>`) or the create sheet (`/plans?new=1`) instead of a bare `/plans` (2026-07-08); data layer in `lib/hooks/use-today.ts` |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working — v2 pass shipped (PR #21): page title + card labels, teal links, 44px targets, full-width save, serves line + sample-data seeder removed; atomic `save_recipe` RPC live; mobile editor takeover (PR #17); **in-app import shipped (PR #29): Import button + `?import=1` → paste/URL → LLM parse → review screen → save via the shared `saveRecipeForm`** (`components/recipe-import.tsx`, `lib/hooks/use-import.ts`); save/delete patch the list locally instead of a full reload (M10 PR 2, PR #35); data layer in `lib/hooks/use-recipes.ts` |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working — v2 pass shipped (PR #22): flat hairline rows, full-width teal "Start cooking" (launches `components/cook-mode.tsx`), breadcrumb + one-row actions, pantry-badge quirk fixed; a bad id now renders the not-found boundary (M9, PR #33); zero amounts render "to taste" in the ingredient list and cook-mode chips (PR #38, 2026-07-11) |
| Plan | `/plans` (`app/plans/page.tsx`) | Working — flat day lists (no lunch/dinner division, PR #18; `meal_type` vestigial); adding a meal opens a **full-screen takeover** (`components/plan-add-meal.tsx`, 2026-07-08 — replaced the inline quick-add that fought the iOS keyboard; same recents-first search + Enter/Shift+Enter, all three modes); reads `?plan`/`?new` deep links; "Shop this plan" exit; day items in `components/plan-day-items.tsx`; item writes (serving/add/remove) are optimistic with per-item rollback (M10 PR 2, PR #35); data layer in `lib/hooks/use-plan.ts` |
| Shop | `/grocery` (`app/grocery/page.tsx`) | Working — reflow chunky direction (pinned order bar, 30px checks, sticky sections); transactional state-preserving regeneration underneath; **no longer regenerates on load — a stale plan shows an amber banner + explicit Generate/Update button (M10 PR 1, PR #34, SB1: A)**; reads `?plan=<id>` to land on a specific plan (from the plan screen's "Shop this plan", 2026-07-08); item writes (check/pantry/on-hand) are optimistic with per-item rollback (M10 PR 2, PR #35); zero-amount rows render "to taste" (PR #38, 2026-07-11); same-dimension duplicates merge into one line in the largest contributing unit on regeneration (M12, PR #39, 2026-07-11); data layer in `lib/hooks/use-grocery-list.ts` |
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
| 12 | Grocery unit merge (dimension-aware grouping) | **Done (2026-07-11)** — PR #39 (`codex/grocery-unit-merge` → `main` `257a836`); fifth migration `20260711225000_grocery_unit_merge.sql` applied to prod same day (full ritual, rolled-back live smoke). `units.base_factor` + dimension-keyed `regenerate_grocery_list`; pgTAP 108 → 141. [plans/unit-merge.md](plans/unit-merge.md) |
| 13 | Plan copy | **Dropped (2026-10-02)** — the owner rarely reuses whole weeks; superseded by M17. [plans/plan-copy.md](plans/plan-copy.md) (history) |
| 14 | Dark mode (system-follow) | **Specced, not started; fourth in the 2026-10-02 order** (after 17 → 18 → 19). [plans/dark-mode.md](plans/dark-mode.md) |
| 15 | Richer empty states | **Dropped (2026-10-02)** — mostly serves a brand-new account. [plans/empty-states.md](plans/empty-states.md) (history) |
| 16 | Step↔ingredient link (accurate cook-mode chips) | **Superseded (2026-10-02) by M18** — cook mode is unused and being retired. [plans/step-ingredients.md](plans/step-ingredients.md) (research only) |
| 17 | Weekday suggestions + Add the usuals | **Specced, builder-ready; next up, waits on the owner's go-ahead** (forks F1/F2 answered). [plans/weekday-suggestions.md](plans/weekday-suggestions.md) |
| 18 | Amounts in the steps (and retire cook mode) | **Specced, builder-ready** (fork W1 answered: no wake lock); two PRs plus an owner-gated prod backfill. [plans/amounts-in-steps.md](plans/amounts-in-steps.md) |
| 19 | Upkeep: Node and platform | **Scoped (2026-10-02)** — CI and Vercel to a current Node LTS; spec when picked. [roadmap.md](roadmap.md) Re-plan |

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
- Tests: vitest for `lib/` domain logic (141 across 9 files); pgTAP for the
  database layer (141 across four suites) on an ephemeral local/CI stack.
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
- `npm audit`: root **0** as of 2026-10-02 (PR #40; it had regressed to 8
  over the summer, 1 critical in `next`). `mcp/` shows 7 (1 low, 3 moderate,
  3 high), unaddressed: a local stdio server, out of scope unless a task names
  it (its 2026-07-03 in-range fix had taken it 9 → 0).
- Node: CI runs Node 20 (end of life 2026-04-30), `@supabase/*` declare
  Node ≥ 22 (CI warns only), and Vercel's Node version isn't pinned:
  milestone 19.
- Full register: [design-flags.md](design-flags.md).

## Where to go next

- Redesign intent — [redesign-brief.md](redesign-brief.md)
- Milestones and deferred work — [roadmap.md](roadmap.md)
- Verification and runbooks — [qa.md](qa.md), [architecture.md](architecture.md)
- Data model — [data-model.md](data-model.md) (canonical: `supabase/schema.sql`)
- Decisions and history — [decisions.md](decisions.md), [progress-log.md](progress-log.md)
