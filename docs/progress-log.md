# Progress Log

This is an append-only, decision-rich log. Add the newest entry at the top.
Include outcomes, important tradeoffs, verification, and remaining work.

## 2026-07-03 (latest) - schema.sql baseline/ALTER consolidation (proven schema-neutral)

Cleared the last-but-one backlog loose end. `supabase/schema.sql` had
accumulated historical inline `ALTER`s interleaved with the baseline `CREATE`s,
making the canonical file hard to read.

- **What changed:** dropped statements that a fresh build treats as no-ops —
  `add column if not exists` for columns the CREATE already declares
  (`groceries_version`, `slot_type`, `leftover_from_item_id`, `note`,
  `is_on_hand`), a `recipe_id drop not null` (CREATE is already nullable), a
  legacy `drop index meal_plan_items_unique_slot_idx`, and a
  `set slot_type='cook'` backfill. **Folded** the two substantive named CHECK
  constraints (`meal_plan_items_slot_recipe_check`,
  `meal_plan_items_leftover_link_check`) into the `meal_plan_items` CREATE
  TABLE. schema.sql 735 → 699 lines.
- **Decision (why fold, not migrate):** the design-flag floated "move historical
  ALTERs into `migrations/`". Rejected — these predate the forward-only
  directory and are already applied to prod; `schema.sql` is a canonical
  *snapshot* (reflects current state), not a changelog. New changes still go in
  as forward migrations; old pre-directory history belongs in the base DDL.
- **Verification (the bar for touching the canonical schema):** built a fresh
  local DB from the *old* baseline, `pg_dump --schema-only` → dump A; applied
  the consolidation, regenerated the baseline copy, rebuilt, dumped → dump B.
  **A and B are byte-identical** except pg_dump 18's per-run random `\restrict`
  session nonce (2 lines) — i.e. the effective schema is unchanged. pgTAP
  108/108 on the consolidated schema; typecheck + vitest 16/16. Both folded
  constraints confirmed present in the built DB with correct names/definitions.
- **Prod:** untouched. `schema.sql` is a reference file, never `db push`ed; prod
  already has this exact schema hand-applied. The regenerated baseline copy
  keeps the new CI drift guard green.
- **Backlog now:** one loose end left — `mcp/` npm-audit (9, separate package).

## 2026-07-03 - CI guard: baseline migration must match schema.sql

Closed a standing CI follow-up. The CI/local-only baseline migration
(`supabase/migrations/20260101000000_baseline_schema.sql`) is a **verbatim
copy** of `supabase/schema.sql` (regenerated with `cp`), so nothing stopped the
two from silently drifting — a drift would build a stale schema on every fresh
CI/local DB and make the pgTAP suite validate against the wrong baseline.

- Added a **"Baseline schema matches schema.sql"** step to the `db-tests` job in
  `.github/workflows/ci.yml`, placed right after checkout and **before**
  `supabase start` so drift fails fast with no Docker image pulls. It runs
  `diff -u schema.sql <baseline>` and, on any difference, prints a
  `::error::` with the exact regenerate command (`cp supabase/schema.sql
  supabase/migrations/20260101000000_baseline_schema.sql`) and exits 1.
- **Verified locally both ways:** in-sync → exit 0; injected a one-line drift
  into the baseline → step correctly failed with the diff; baseline restored to
  byte-identical (28193 bytes each). The two files are in sync at commit time.
- Docs updated: `supabase/migrations/README.md` (follow-up → enforced),
  `roadmap.md` (M1.5 follow-ups now all cleared — also corrected the stale
  `config.toml major_version` item, confirmed 17 vs prod 17.6 back on
  2026-07-01), `current-state.md` (CI description + loose-ends list).
- **Backlog now:** two lower-priority loose ends remain — `mcp/` npm-audit (9,
  separate package) and the `schema.sql` baseline/ALTER consolidation.

## 2026-07-03 - Round-1 review-board pins signed off (all defaults kept)

Owner reviewed the ten open round-1 review-board pins and signed off on every
one as-shipped — **no code changes**. Docs-only session recording the verdicts
in the two living registers so the next session doesn't re-ask.

- **T1–T4 (Today):** settings gear in the Today header (off the 4-tab bar);
  plan-less Today teal hero → `/plans` + recipes pointer; link hover stays v2
  **amber** `#e8a13d` (`--brand-2`) — flip back to teal (`--brand`) is a
  one-line token change if it ever reads as two competing accents; desktop
  column capped at 640px (`.page-col`).
- **P1–P3 (Plan):** inline collapsible edit panel (not a modal); "Generate
  grocery list" is a link to `/grocery` (Shop's staleness regen does the work
  on arrival); filter pills + compact plan picker kept above the day rows.
- **S1–S2 (Shop):** manual Regenerate ghost button kept as the escape hatch
  alongside auto-regen; On-hand section defaults collapsed.
- **C2 (Cook):** "Done — mark cooked" **stays a no-op exit**. No cooked/
  `cooked_at` state added; schema unchanged. **Decision (why):** no concrete
  consumer today (Today is built and doesn't need it). Adding cooked state
  later remains a schema change + migration on the usual rails — and the
  meaning of "cooked" for multi-night leftovers would need pinning down first.

Docs touched: `design-flags.md` (four flags moved Open → Resolved),
`current-state.md` (phase paragraph, Active Handoff, Open issues, Last
reviewed). All review-board pins (rounds 1–4) are now resolved; the backlog is
down to three lower-priority loose ends (`mcp/` npm-audit, CI baseline-vs-
`schema.sql` guard, `schema.sql` baseline/ALTER consolidation).

## 2026-07-03 - Four standing follow-ups cleared (CI actions v5, ws advisory, settings-defaults SoT, userEmail cleanup)

Cleared four standing follow-ups in one session, all low-risk and merged
directly to `main` (no PRs) after review + verification. `main` advanced
`2e354eb → aada18f`; CI green on every push; Vercel redeployed.

- **CI actions `@v4 → @v5`** (`codex/ci-actions-v5`, commit `b13e5c6`, merge
  `2e8bc09`): bumped `actions/checkout@v4 → v5` (both jobs) and
  `actions/setup-node@v4 → v5`, clearing the Node-20 runtime deprecation that
  CI annotations had started flagging. Left `supabase/setup-cli@v1` (no v5
  exists) and `node-version: 20` (app toolchain, separate concern) untouched.
  Confirmed live: the post-merge run on `main` was green on v5 (1m12s).
- **ws advisory → 0 vulns** (commit `f136694`): `npm audit fix` updated the
  `@supabase/*` chain `2.95.3 → 2.110.0`, which stays inside the declared
  `^2.49.1` range, so newer `@supabase/realtime-js` drops the vulnerable `ws`
  entirely. **Lockfile-only** — `package.json` unchanged; `npm audit` went
  3 high → **0**. Not a major bump, so no owner-approval-gated dependency
  upgrade was needed beyond applying the fix.
- **Settings-defaults single source of truth** (commit `f56c610`): added
  `DEFAULT_USER_SETTINGS` to `lib/constants.ts` mirroring the SQL column
  defaults in `supabase/schema.sql` (plan_days 7, week_starts_on 5,
  order/pickup weekday **null**). Removed the four inline `{7,5,3,4}` copies
  (settings form `initialForm`, `ensureUserSettings` upsert, and two spots in
  `use-plan.ts`). **Decision (why):** owner chose "client matches SQL —
  null/unset" over "codify Wed/Thu as DB defaults (migration)", so schema
  stays canonical and no migration was needed. **Behavior note:** brand-new
  users now get *unset* order/pickup dates (they pick their own days) instead
  of the old auto-Wed/Thu; existing users load their saved settings from the
  DB and are unaffected. The `lib/date-utils.test.ts` fixture keeps explicit
  3/4 — it exercises the non-null weekday path, not a default.
- **userEmail dead-threading removed** (commit `3b84f08`): `AppShell` never
  rendered `userEmail`. Dropped it from `AppShellProps` and stopped threading
  it from the five screens that only forwarded it (Today, Plan, Shop, Recipes,
  recipe detail). **Decision (why):** owner chose remove over building an
  account/sign-out affordance. Settings keeps its own `userEmail` — it renders
  the signed-in address itself (`{userEmail ?? "Signed in"}`).
- **Verification (as run):** `eslint .` clean at 0 warnings; `tsc --noEmit`
  clean; vitest 16/16; `next build` green (11/11 pages). Residual greps
  confirm `userEmail` survives only where Settings renders it, and `3/4` only
  in the test fixture. Two CI runs on `main` green (actions-v5 merge 1m12s;
  standing-followups merge 1m14s), both jobs (app-checks + 108 pgTAP) passing.
- **Remaining:** the ten round-1 board pins (T1–T4, P1–P3, S1–S2, C2) still
  await owner verdicts — untouched this session.

## 2026-07-03 - ESLint flat config + CI lint gate (PR #23)

Cleared the "`npm run lint` non-functional" follow-up. Migrated off the
deprecated `next lint` (removed in Next 16) to the ESLint CLI on a flat
config, and made it a CI gate. Merged as `83d0b86`, deployed to Vercel,
green on `main`.

- **Setup** (`codex/eslint-ci`, commit `1b50329`, merge `83d0b86`): new
  `eslint.config.mjs` — the Next codemod's flat config, `next/core-web-vitals`
  + `next/typescript`, ignoring `mcp/**` (separate package, own build);
  `package.json` lint script `next lint` → `eslint . --max-warnings=0`; devDeps
  `eslint@9.39.4`, `eslint-config-next@15.5.20`, `@eslint/eslintrc@3.3.5`.
- **Decisions (why):** (1) *strict ruleset* — owner chose core-web-vitals +
  typescript over core-web-vitals-only, for the TS-aware layer on top of `tsc`.
  (2) *`--max-warnings=0`* — finished at zero warnings, so this locks the clean
  slate and keeps local == CI (the parity value the CI comments already state);
  intentional exceptions use an inline `eslint-disable`, matching the existing
  hook pattern. (3) *decouple the build* — `eslint.ignoreDuringBuilds` in
  `next.config.mjs` so `next build` stops linting via the deprecated path (build
  now prints "Skipping linting"; TS checking during build is unaffected),
  leaving the CLI step as the single gate. (4) *delivery* — owner chose branch
  + PR so the new CI lint step proved green on the PR before merge.
- **First-run findings (7), all resolved:** 3 errors were all in `mcp/dist`
  (a build artifact in the out-of-scope MCP subpackage) → fixed by ignoring
  `mcp/**`, not a code change. 4 warnings fixed: the unused `userEmail`
  destructure in `AppShell` (dropped from the signature, kept in the prop type
  so the six callers are untouched), and 3 dead `react-hooks/exhaustive-deps`
  disable directives in the hooks (the rule is active — one *used* directive
  remains at `use-grocery-list.ts` — and reported nothing at the removed sites;
  re-ran lint to confirm no removal unmasked a real warning).
- **New flag raised:** every screen threads `userEmail` into `<AppShell>`,
  which never renders it — likely an account/sign-out affordance wired but
  never built. Logged in [design-flags.md](design-flags.md) (open); owner
  decides build-it vs. remove-the-threading.
- **Dependency safety:** the 3 devDeps added zero new audit findings — the root
  "3 high" are the pre-existing `ws → @supabase/realtime-js →
  @supabase/supabase-js` chain (docs previously said "1 high"; same underlying
  vuln, now counted as 3 chain nodes).
- **CI observation (feeds a standing follow-up):** both jobs now annotate the
  Node-20 deprecation — `actions/checkout@v4` / `setup-node@v4` /
  `supabase/setup-cli@v1` are force-run on Node 24. Confirms the "Actions
  Node-20 version bump" follow-up is live; a `@v4 → @v5` bump would clear it.
- **Verification (as run):** `eslint .` clean at 0 warnings; `tsc --noEmit`
  clean; vitest 16/16; `next build` green (11/11 static pages, "Skipping
  linting"). CI green on PR #23's first run (app-checks 47s, db-tests 1m7s) and
  again on `main` post-merge (49s / 1m12s). pgTAP untouched (108/108).
- **Remaining:** none for this unit — merged, deployed, verified.

## 2026-07-02 (evening) - V2 Sweep complete: Recipes pass (PR #21) + recipe detail (PR #22)

- **Round-3 board (Recipes library + editor):** before shots + two
  CSS-injected direction mocks per screen (A: v2-dressed cards / stacked
  editor; B: flat hairline rows / iOS-row top fields), redeployed in place
  to the same artifact URL. **Owner verdicts:** RC1: A *with the serves
  line dropped* ("unnecessary for this screen") · RC2: yes (rode along
  with the A mocks) · RC3: **remove "Load sample data" outright** ("left
  over from before we had Recipes") · RC4: A · RC5: full-width.
- **PR #21 — Recipes pass** (`codex/v2-recipes`, feat `9fdcd5d` + chore
  `9821afd`, merge `1a9401b`, deployed): "Recipes" page head + uppercase
  card labels (`.recipes-head`/`.recipes-card-label`, grouped with the
  `.settings-*` selectors), 44px search/sort/inputs/buttons, teal
  "View recipe" links (were the app's last browser-default blue links),
  serves line removed, and the whole sample-data flow retired
  (`SAMPLE_RECIPES` + `loadSampleData` + `seeding`, ~280 lines; the dead
  `upsertTags` helper went with it). Page head hides with the list in the
  mobile editor takeover so the editor title leads.
- **Bug found by verification, fixed in PR #21:** the "Recipe saved."
  confirmation never displayed — `saveRecipe` set the message, then the
  post-save `selectRecipe` reload cleared it before paint (true on prod
  since the M6 extraction). Fix: set the message after the reload
  completes. The verify script's save round-trip caught it (RPC 200 but
  no status node).
- **Round-4 board (recipe detail):** mocks A/B, same rhythm. **Owner
  verdicts:** "variant B for both" (RD1 flat hairline rows for ingredients
  *and* steps; RD2 full-width teal Start cooking, RD3 header language +
  44px stepper, RD4 badge fix rode along) · **RD5: yes** (answered in a
  follow-up after the first build — added to the branch before merge).
- **PR #22 — recipe detail pass** (`codex/v2-recipe-detail`, feat
  `006b0ca` + chore `4086954` + RD5 `ba24797`, merge `74da4ea`, deployed):
  flat rows both lists, chunky Start cooking under the STEPS label (same
  handler; `?cook=1` unchanged), page-head title + uppercase labels + 44px
  stepper, and the **pantry-badge cascade quirk fixed at the root** — the
  `.recipe-meta span` rule (0-1-1) that out-specified `.pantry-badge`
  (0-1-0) is gone; its styling moved to the existing `.recipe-amount`
  class, so the badge's amber text finally renders (closes the V1 quirk).
  RD5: ghost Back → "‹ Recipes" breadcrumb above the title, Edit + More
  on one row — Start cooking now lands above the fold at 390px.
- **Verification (as run):** both PRs — typecheck clean, vitest 16/16,
  `next build` green locally and in CI (pgTAP 108/108, DB untouched).
  Playwright on the local stack, prod route-blocked: PR #21 22/22 + live
  `save_recipe` round-trip (2→3, persisted, reverted; seed data restored
  after an earlier timed-out run left it at 3); PR #22 15/15 + stepper
  rescale, Cook takeover open, `?cook=1` auto-open — zero console errors.
  Two transient "Failed to fetch" console errors during verification were
  traced to the harness (navigation aborting the in-flight settings POST),
  not the app; the script now settles before navigating.
- **Toolkit preserved:** `capture-recipes-variants.mjs`,
  `verify-recipes-pass.mjs`, `gen-board-r3.mjs` (PR #21);
  `capture-detail-variants.mjs`, `verify-detail-pass.mjs`,
  `gen-board-r4.mjs` (PR #22). The board's artifact URL is unchanged;
  round 4 now shows the full sweep record with all pins resolved.
- **Milestone 7 is complete** (PRs #19–#22). Remaining work: the ten open
  round-1 board pins (owner verdicts wanted) and the standing follow-ups
  (settings-defaults source of truth, ESLint + CI lint, npm-audit triage,
  Actions Node-20 bump).

## 2026-07-02 (afternoon) - V2 Sweep: token fix (PR #19) + Settings pass (PR #20) shipped

- **Part 1 — the token fix** (PR #19, `codex/v2-token-sweep`, `db98272`,
  merged `e5d2cfd` + deployed): all 20 hardcoded old-palette literals in
  `app/globals.css` swapped for token-set-v2 variables. Mappings: the ≤700px
  `.panel` cream (border `#e4d8c6`, translucent `rgba(255,253,248,.92)`) →
  `--line`/`--surface` (mobile panels now opaque; the faint box-shadow kept
  as an elevation cue, not palette); recipe-detail creams (`#c9bba6`,
  `#fffefb`, `#3d443d`) → line/surface/muted; `.pantry-badge` → the amber
  accent set (mirrors `.chip.active`'s strong-border-on-soft-tint); eleven
  stray `#fff`/`#ffffff` → `--surface` (computed-identical, so zero visual
  change on the cycle screens). Acceptance grep clean: hex in `globals.css`
  hits `:root` definitions only. No selector or layout changes.
- **Cascade quirk found while verifying** (flagged, deferred to the
  recipe-detail pass): `.recipe-meta span` (specificity 0-1-1) has always
  overridden `.pantry-badge`'s own color/size (0-1-0) — the badge never
  rendered its old `#5e513d`; it rendered `#3d443d` before the sweep and
  `var(--muted)` after. Part 1 preserved the quirk for mechanical parity.
- **Round-2 review board** (redeployed in place to the round-1 artifact URL):
  part-1 before/after pairs (befores are labeled CSS reconstructions) plus
  two CSS-injected Settings direction mocks — A (v2 dress on the stacked
  form) vs B (iOS-style rows). **Owner verdicts, direction delegated
  ("they all look good, open to your recommendations"):** V1 keep (amber
  badge outline) · V2 fine (opaque panels) · ST1: B · ST2: full-width save ·
  ST3: page title + card labels.
- **Part 2, screen 1 — Settings** (PR #20, `codex/v2-settings`, `ce090f8`,
  merged `83cb415` + deployed): content in the `.page-col` 640px cap;
  `.settings-head` h1 (the cycle screens' header pattern); uppercase
  `.settings-card-label`s (Account / Planning defaults); one `.settings-row`
  per setting — label left, control right at ≤46%, hairline dividers, 44px
  controls and sign-out; `.settings-save` full-width teal (Plan's Generate
  language). Behavior-neutral: same state, handlers, upsert, StatusMessage.
- **Verification (as run):** PR #19 — typecheck clean, vitest 16/16,
  `next build` green; Playwright at 390px on the local stack: 22/22
  computed-style assertions across Settings / recipes list / editor
  takeover / recipe detail, a full-DOM scan finding zero retired palette
  values, zero console errors, zero prod requests (route-blocked at the
  browser). PR #20 — typecheck clean, vitest 16/16, build green; 13/13
  assertions (title, labels, 2-col rows, ≥44px controls, full-width teal
  save, 640px cap) plus a **live save round-trip** (plan length 7→9 saved,
  persisted through reload, reverted) and a desktop sanity shot — zero
  console errors. All four CI runs (2 PRs + 2 merge pushes) first-try green;
  twenty PRs merged, streak intact.
- **Toolkit:** round-2 scripts preserved in `scripts/review-board/` with
  repo-relative paths — settings-variant capture, both verify drivers
  (token sweep, Settings pass), and the round-2 board generator.
- Remaining: part 2 continues with the **Recipes library + editor pass**
  (mocks-first, same rhythm), then **recipe detail** (which also resolves
  the badge-text cascade quirk); 10 round-1 board pins still open; standing
  follow-ups unchanged (settings-defaults SSOT, ESLint + CI lint, npm audit
  triage, Actions Node-20 bump).

## 2026-07-02 (morning/afternoon) - Reflow Review Round 1: flat days, quiet chips, mobile editor

- **Review method that worked:** built a pinned-screenshot review board (a
  private claude.ai artifact) — the 12 flagged reflow defaults pinned by code
  (T1–T4, P1–P4, S1–S2, C1–C2) on real screenshots captured on the local
  stack with seeded sample data. The owner replies in chat by pin code; two
  chip-restyle variants were mocked via CSS injection on the live local app
  before any code was written. Capture/generation toolkit preserved in
  `scripts/review-board/` for the next round.
- **Owner verdicts (round 1):** C1 — chips keep the name-match heuristic but
  shrink to variant B (one muted text line). Plus three new requests: drop
  the lunch/dinner division entirely (flat "meals for the day", multiples
  stay, hero shows up to two); improve the quick-add recipe list on mobile;
  stop the recipe editor from stacking below the full list on mobile.
- **Shipped (both merged + deployed 2026-07-02 ~09:00 PDT):**
  - **PR #17** (`codex/cook-chips-recipes-editor`): cook-step ingredients as
    one quiet `--color-slate-text-muted` line; on ≤700px the recipe editor
    replaces the list ("‹ Back to recipes", scroll-to-top on open). Also
    carried the review-round flag-register updates.
  - **PR #18** (`codex/plan-flat-days`): flat day lists — `meal_type` is now
    **vestigial** (NOT NULL column stays; every new row writes `'dinner'`;
    nothing reads it; **no migration**). Existing lunch rows render in their
    day's list in `created_at` order. Quick-add is per-day and mobile-first:
    44px rows with serves count, most-recently-planned recipes before typing
    (soft query over `meal_plan_items`, degrades to name order), keyboard
    hints hidden on touch. Today: hero label "Tonight", headlines the first
    cook meal, "Also tonight: …" + "+N more"; week peek drops meal-type
    sublabels. `PlanSlotCell` → `PlanDayItems`; `clearSlot`/backspace-clear
    retired with the slot concept.
- **Verification:** typecheck clean, vitest 16/16, `next build` green on both
  branches; Playwright drives with assertions on the local stack (chip
  computed styles; editor scrollY=0/list-hidden/back-label; zero L/D spans;
  legacy lunch row in its flat day list; quick-add row height ≥44 + serves
  count; leftover labels carry no meal type; tap-add and Enter-add; the
  two-meal hero) — zero console errors. All four CI runs (2 PRs + 2 merge
  pushes) first-try green.
- **Gotchas recorded:** (1) running `next build` (which reads `.env.local`'s
  prod URLs) while the env-overridden dev server shares `.next` breaks the
  dev bundle's Supabase target — fix: `rm -rf .next`, restart dev with the
  local-stack env. (2) `meal_plan_items_slot_recipe_check` requires leftover
  rows to carry the source `recipe_id` (cook/leftover ⇒ recipe NOT NULL).
- **Also:** the owner pushed `cde7c1e` (`npm run dev:phone`) to `main`
  himself mid-session. New flag raised and **owner-approved as next work**:
  "Pre-reflow remnants" — hardcoded old-palette values in `globals.css`
  (the ≤700px `.panel` cream override skins every mobile panel) plus the
  un-swept screens; plan is milestone 7 (V2 Sweep): token-fix PR first,
  then per-screen passes (Settings → Recipes library/editor → recipe
  detail).
- Remaining: v2 sweep part 1 (next action), 11 open board pins, standing
  follow-ups (settings defaults, ESLint, npm audit, Actions bump).

## 2026-07-02 (late night) - Reflow Screen 4: Plan — THE REFLOW IS COMPLETE

- **Plan shipped** (branch `codex/reflow-plan`) — the fourth and final reflow
  screen: `/plans` rebuilt as the mockup's day rows over the unchanged
  `use-plan` data layer. One card per day (uppercase day head, teal "· today"
  highlight), slot rows with explicit L/D markup labels, quick-add (+) as the
  primary action (Cook search / Leftovers select / Eating-out note — same
  machinery, restyled), compact −/×N/+ serving controls, New-plan and
  Edit-plan sheets toggled from the header (auto-close on plan switch), plan
  filter pills + compact picker, and "Generate grocery list" as the flow's
  exit (links to Shop; staleness regeneration does the generating).
- **Flag fixed at the root: the nth-child mobile-label coupling** — the
  `::before` Lunch/Dinner injection is deleted; labels are real markup in
  `plan-slot-cell.tsx`. Also swept the CSS of the dead dashboard styles
  (`.home-*`, old `.plan-grid` family) left behind by the Today swap.
- **Defaults flagged for owner** ([design-flags.md](design-flags.md)): inline
  sheets rather than a modal, generate-as-link, filters/picker kept above the
  day rows, multi-item slots as stacked rows + "+ add another".
- **Verification:** typecheck clean; vitest 16/16; `next build` green.
  Driven end-to-end on the local stack (playwright-core, iPhone viewport):
  plan created through the new sheet (7 day rows, today highlighted), cook
  quick-add via match click AND via Enter-adds-first-match, serving ×1→×1.25,
  leftovers (provenance sub-line), eat-out with note, remove, edit sheet
  end-date −1 (7→6 rows), **Generate → Shop built the list (7 items) → Today
  hero showed tonight's dinner** — the full weekly cycle through all four new
  screens; zero console errors.
- **The reflow (Cook → Today+v2 → Shop → Plan) is complete**: four screens in
  four PRs (#13, #14, #15, this one), all first-try green CI, shipped same
  day under the pre-approved rails. Remaining owner decisions live in
  [design-flags.md](design-flags.md); deferred follow-ups (settings-defaults
  SSOT, ESLint, npm audit, Actions version bump) are unchanged in the
  roadmap.

## 2026-07-02 (late night, Shop) - Reflow Screen 3: Shop

- **Shop shipped** (branch `codex/reflow-shop`): `/grocery` restyled to the
  mockup's chunky direction over the unchanged `use-grocery-list` data layer —
  pinned slate order bar ("Order today/tomorrow/{Day}" + pickup, big amber
  live unchecked count), sticky "Groceries" / "Pantry check" section heads
  with check-all/uncheck-all, 30px checkbox buttons (teal fill +
  strikethrough when done), tabular amounts, small muted per-row moves
  (have this / move to groceries / move back). All previous functionality
  preserved. `use-grocery-list` gained `order_date`/`pickup_date` in the plan
  select (additive); `formatRelativeDay` promoted to `lib/date-utils`
  (shared with Today, tested).
- **Defaults flagged for owner** ([design-flags.md](design-flags.md)):
  Regenerate button **kept** (the brief's open question — auto-regeneration
  on staleness remains primary; the button is the escape hatch), On hand
  section now defaults collapsed, and the plan sidebar became a compact
  picker shown only with 2+ active plans.
- **Token housekeeping:** the `--color-cook-*` set renamed to
  `--color-slate-*` now that Shop's order bar shares it; amber usages
  consolidated on `--brand-2`; `--font-cook` dropped (native stack is global
  since Today); `.today-col` generalized to `.page-col`. Design-system tables
  updated.
- **Verification:** typecheck clean; vitest 16/16; `next build` green.
  Driven end-to-end on the local stack (playwright-core, iPhone viewport):
  seeded plan with 2 cook dinners → list auto-generated through the app →
  order bar asserted ("Order today", count 12), check-off (count 12→11, teal
  + strikethrough), **Regenerate preserved checked state** (M4 exercised at
  the UI level), have-this/move-back and pantry→groceries moves with live
  count updates, check-all; desktop capture; zero console errors.
- **Next: Plan** (reflow screen 4, last) on `codex/reflow-plan` — day rows
  with L/D chips, quick-add as primary action, today highlighted, "Generate
  grocery list" as the exit, range/order/pickup editing behind an edit sheet;
  candidate to finally fix the nth-child mobile-label coupling. Open
  question: multi-recipe slots and eat-out chip details.

## 2026-07-02 (late night, Today) - Reflow Screen 2: Today Replaces the Dashboard; Token Set v2 App-Wide

- **Operating change (owner, this session):** commits, pushes, and merges are
  **pre-approved for the remainder of the reflow** on the usual rails
  (branch → PR → green CI → merge), with docs updated per screen; previews
  are skipped — the owner tests in prod. Recorded in
  [decisions.md](decisions.md) (Reflow Release Rails). Schema/dependency/
  live-data actions still need explicit approval.
- **Today shipped** (branch `codex/reflow-today`): `app/page.tsx` rebuilt as
  the mockup's Today screen over a new `lib/hooks/use-today.ts` — Tonight
  hero (recipe, "Serves N · M steps · planned range", **Start cooking →**
  deep-linking to `/recipes/[id]?cook=1`, which now auto-opens the Cook
  takeover), amber deadline strip with the live unchecked count (whole strip
  links to Shop), remaining-week peek (leftover pill, eat-out notes, `plan →`
  pill on empty days), next-week nudge. Plan-less state (the brief's open
  question) defaults to a "Plan your week to get started" hero — flagged for
  owner refinement.
- **Bug fixed at the root:** the dashboard's 4-newest-plans window
  (empty-current-week flag) — Today loads items for the date-relevant current
  plan and its successor only; past-only history now renders the plan-less
  state instead of resurrecting a finished plan. Flag moved to Resolved.
- **Token set v2 landed app-wide** with this screen per the brief's
  sequencing: paper `#fafaf8` ground, ink `#16211e`, sharpened teal
  `#12695e`, hairline `#e4e6e1`, amber `#e8a13d` as the single warm accent
  (terracotta retired), decorative body gradients removed, and the
  **native system font stack replaces Fraunces/Manrope** (next/font Google
  fonts removed from `layout.tsx`; `--font-body`/`--font-heading` are plain
  tokens now). `lib/design-tokens.ts` mirrors updated (manifest/theme-color).
  Old screens read the same semantic variables and restyled cleanly
  (verified visually).
- **Tabbar reflowed:** Today / Plan / Shop / Recipes with icon+label tabs
  (4-col); Settings moved to a gear in the Today header — flagged for owner
  confirmation along with the amber link-hover and the 640px desktop column.
- **Verification:** typecheck clean; vitest 15/15 (new `formatDayAbbrev`
  covered); `next build` green (11 routes). Driven end-to-end on the local
  stack (playwright-core, iPhone viewport): fresh sign-up → sample recipes →
  plan+items seeded in the local DB → grocery list generated through the real
  app → Today asserted (hero text/meta, strip "due tomorrow · 7 unchecked",
  week rows incl. leftover pill and eat-out, nudge), Start cooking →
  takeover auto-open, settings gear → `/settings`, plan-less second user,
  desktop + recipes-under-v2 screenshots — zero console errors.
- Docs: `docs/pages/today.md` replaces `pages/dashboard.md`; routes.md,
  README, design-system.md (v2 token tables, typography, Today/Cook
  patterns) updated.
- **Next: Shop** (reflow screen 3) on `codex/reflow-shop` — pinned order bar
  with live unchecked count, 30px chunky checkboxes, groceries vs
  pantry-check sections, checked = teal fill + strikethrough, over
  `use-grocery-list`. Open question: keep the manual "Regenerate" button or
  trust staleness.

## 2026-07-02 (late night, Cook) - Reflow Screen 1 Ships: Cook Mode Live in Prod

- **PR #13 merged (`50dd5ac`), first-try green CI (app checks 43s, db tests
  1m03s), Vercel production deploy confirmed.** Branch `codex/reflow-cook`,
  one commit (`1a54460`). The owner tested on-device against real recipes and
  approved skipping the preview step ("I'm the only one that uses this app"),
  so the branch went PR → green CI → merge in one pass.
- **What shipped:** `components/cook-mode.tsx` — the full-screen dark cooking
  takeover from the approved mockup, replacing the recipe detail's in-panel
  focus mode. Step N of M in 1.7rem type, per-step ingredient chips scaled by
  preview servings, amber progress bars, giant amber Next / 30% Back (hidden
  on step 1), screen wake-lock while active (best-effort, re-acquired on
  `visibilitychange`; the "stays awake" note renders only while held), Escape/✕
  exit, body scroll locked behind. Token set v2's first tranche landed with
  it: scoped `--color-cook-*` tokens + `--font-cook` (native stack) in
  `globals.css` — documented in [design-system.md](design-system.md).
- **Decision: per-step chips are a name-match heuristic** — the schema has no
  step↔ingredient link, so chips show when a word of the ingredient name (3+
  letters, plural-tolerant) appears in the step text. Upgraded from full-name
  substring matching after runtime verification caught it under-matching
  (a step referencing six ingredients chipped only "salt" — names like
  "chicken thighs" don't substring-match a step that says "chicken"). Flagged
  in [design-flags.md](design-flags.md) for tuning against real recipes.
- **Decision: "Done — mark cooked" writes nothing** — no cooked state exists
  in the schema; adding one is a migration on the usual rails. Decide when
  Today is built (Today is the consumer). Per-step timers stay deferred.
- **Verification:** typecheck clean; vitest 15/15; `next build` green (11
  routes). Driven end-to-end on the local Supabase stack with playwright-core
  (cached Chromium, iPhone viewport): sign-up → sample seed → full step walk,
  Back/Done/Escape, rapid-tap on Done, servings scaling into chips, desktop
  sanity — zero console errors. Wake-lock confirmed working on prod (HTTPS;
  plain-HTTP LAN testing can't exercise it).
- Flag updated: the wake-lock half of "no wake-lock / thin empty states / no
  dark mode" is resolved; two new Cook flags opened (chips heuristic,
  mark-cooked no-op).
- Notes: Cook on desktop is functional but stretched (full-width amber button,
  no max reading measure) — phone is the target, revisit if it grates. CI now
  warns `actions/checkout@v4` / `setup-node@v4` target deprecated Node 20 —
  bump action versions in a housekeeping pass.
- **Next: Today** (reflow screen 2) on `codex/reflow-today` — replaces the
  dashboard, fixes the 4-newest-plans bug, tabbar changes land with it. Open
  question to answer while building: what Today shows plan-less (first run /
  gap weeks).

## 2026-07-02 (night, M6 wrap) - M6 Complete: Slice 4 Ships useRecipes + Shared PlanSlotCell

- **PR #12 merged (`3409fd9`), first-try green CI (app checks 42s, db tests
  1m03s), deployed to Vercel.** Slice 4 on `codex/recipes-hook-slot-cells`,
  two commits:
  - `lib/hooks/use-recipes.ts` extracted from `app/recipes/page.tsx`
    (859 → 359 lines): recipe/tag/unit loading, the editor form and its
    save/delete/seed flows, list filtering, and editor visibility (the write
    flows and the `?edit=` deep link mutate it, so it lives in the hook,
    which takes `editRecipeId` as a parameter — the page still reads
    `useSearchParams`). The tag-input draft stays in the page as
    presentation-only state, per the grocery-page precedent.
  - `components/plan-slot-cell.tsx` unifies the two ~164-line near-identical
    lunch/dinner blocks in `app/plans/page.tsx` (571 → 266 lines). Root div
    stays `plan-slot-cell` as a direct child of `plan-grid-row`, so the
    mobile Lunch/Dinner labels injected by the nth-child `::before` rules in
    `globals.css` keep matching; per the approved scope (strict behavior
    neutrality) the coupling was preserved, not restructured — flag stays
    open, single edit site now the component.
- **Decision (owner):** settings-defaults single source of truth is split out
  of M6 as its own follow-up; **milestone 6 closes with slices 1–4.** See
  [decisions.md](decisions.md) (Component Hardening Wrap) and the flag in
  [design-flags.md](design-flags.md).
- **Verification:** typecheck clean; vitest 15/15; `next build` green
  (11 routes; plans/recipes still static). Mechanical diff against
  pre-extraction HEAD: recipes-page JSX byte-identical; all six moved data
  functions, both memos, the deep-link effect, all types, and the sample data
  identical (modulo `export` keywords and `React.FormEvent` → type-only
  import); both slot-cell blocks reduce to the component under exactly the
  intended substitutions; the plans-page additions are only the import, the
  shared-props object, and two `<PlanSlotCell>` calls. CI reran the full
  suite (108/108 pgTAP — DB layer untouched).
- Flag resolved: "Duplicated code: formatDisplayDate and lunch/dinner
  columns" (both halves; moved to Resolved in design-flags).
- **Next: the reflow, screen by screen** — suggested order Cook, Today, Shop,
  Plan ([redesign-brief.md](redesign-brief.md) Sequencing); confirm
  Cook-first with the owner at onboard. Token set v2 lands with the first
  reflow screen.

## 2026-07-02 (night, later) - M6 Slices 2-3 Shipped: Grocery and Plans Data Hooks

- **Onboarding caught stranded work:** slice 2 (`useGroceryList`) existed only
  as two unpushed local commits on `codex/component-hardening` — the remote
  branch had been deleted at PR #7's merge, and `git status` on `main` looked
  clean. Lesson encoded: the leave-behind sweep must check local branches
  (`git branch -a` + `git log @{u}..`), not just the working tree. (The prior
  entry's "pushed" claim was written in anticipation of a push that never
  happened.)
- **PR #9 merged (`128cab6`):** slice 2 rebased onto `main` (past PR #8,
  no file overlap), verified, pushed, first-try green CI, deployed. The
  grocery page is presentation-only over `lib/hooks/use-grocery-list.ts`.
- **PR #10 merged (`a9c08a9`):** slice 3 — `usePlan` hook
  (`lib/hooks/use-plan.ts`) extracted from `app/plans/page.tsx`
  (1,091 → 571 lines). Decision: the quick-add state machine moved into the
  hook rather than staying in the page, because `upsertPlanSlot` and the
  keyboard handler mutate it inside the write flows — splitting it would have
  changed behavior. Verification beyond compile: mechanical diff against the
  pre-extraction file — moved logic byte-identical (modulo
  `React.FormEvent`/`React.KeyboardEvent` → type-only imports), JSX differing
  by exactly one identifier (`setSelectedPlanId` → `selectPlan`, matching the
  slice-2 hook API).
- Decision: slice-wise PRs (one per slice) instead of one combined M6 PR —
  protects finished work from stranding again, keeps diffs reviewable, and
  matches the slice-1 precedent.
- Verification: typecheck clean, vitest 15/15, `next build` green (11 routes)
  before each push; CI first-try green on both PRs (app checks 48s, db tests
  1m02s, pgTAP 108/108 each). DB layer untouched; no schema, dependency, or
  behavior changes.
- Remaining M6 (slice 4): recipes data hook + shared lunch/dinner slot-cell
  component; settings-defaults single source of truth still open.

## 2026-07-02 (night) - Mini-M5 Merged; Mockups Approved; Milestone 6 Underway

- Mini-M5 merged (PR #6, `abbf3b2`) and deployed — including a
  `viewport-fit=cover` fix the owner caught on-device: the fixed tabbar's
  `env(safe-area-inset-bottom)` CSS was dormant without it, colliding with the
  iOS home indicator in standalone installs.
- **Direction mockups built and approved** ("huge improvement, I love it"):
  tappable Today / Plan / Shop / Cook screens, calm-utility base + dark chunky
  Cook mode. Source committed to
  [mockups/reflow-v1.html](mockups/reflow-v1.html); app-icon source at
  [assets/icon-source.svg](assets/icon-source.svg). Brief:
  [redesign-brief.md](redesign-brief.md).
- **Milestone 6 started.** PR #7 merged (`dd9006a`): shared date formatters →
  `lib/date-utils.ts` (vitest 15/15) + the brief + a full `current-state.md`
  reconciliation (stale sections and duplicated milestone rows had accumulated
  across incremental patches). Process note: PR #7 was merged while its checks
  were still pending (should have used `--merge --auto`); the run completed
  green minutes later and the post-merge main run was green — ritual restored.
- Slice 2 on the branch: `useGroceryList` hook extraction
  (`lib/hooks/use-grocery-list.ts`); grocery page ~380 → 191 lines,
  behavior-neutral, verified (typecheck / vitest / build).
- Handoff hardening for the next session: mockups + icon source committed
  in-repo, `setup.md` kickoff prompt made evergreen (it still named milestone
  2 as next), roadmap/current-state brought fully current.

## 2026-07-02 (late) - Mini-M5 Shipped; Redesign Direction Set

- **Strategy:** owner wants a larger redesign — look-and-feel plus a reflow
  around the real weekly cycle (Plan → Shop → Cook, with an elevated
  full-screen cooking mode; mobile is the primary surface). Agreed sequence:
  mini-M5 (redesign-proof polish) → milestone 6 (component extraction as the
  redesign's foundation) → redesign brief + token-set mockups (direction:
  calm-utility base with bold/chunky treatment for cook mode and the grocery
  checklist) → implement screen by screen. Milestone 5 rescoped accordingly in
  [roadmap.md](roadmap.md).
- **Mini-M5 (on `codex/ui-feedback-ergonomics`):** app icon generated from the
  design tokens (sharp, no new deps) + web manifest (standalone display) +
  theme-color via `lib/design-tokens.ts` (documented TS mirror of
  `globals.css`); per-page titles (segment layouts + root template); friendly
  error mapping in `lib/errors.ts` (P0001 trigger messages pass through
  verbatim) adopted across all catch sites; `aria-live` `StatusMessage`
  component adopted at every message render site; **session-flash fix**
  (module-level cached session — tab navigations no longer flash "Loading
  session..."); **`ensureUserSettings` duplicate call removed** (open flag,
  half-resolved — the defaults-duplication half remains for M6).
- Verification: typecheck, vitest 13/13, build (11 routes incl. manifest/icons)
  green; no `instanceof Error` leftovers in app code.

## 2026-07-02 (evening) - Milestone 4 Shipped; Reliability Core Complete

- PR #5 green on first CI run (108/108 pgTAP; app checks 47s, db tests 1m12s).
- Prod runbook (owner-approved "apply and merge"): backup (113K) → preflights
  (identical to design: 0 dup identities, 783/783 prefixed) → single-transaction
  apply (`UPDATE 18` backfill — exactly the predicted plans) → verify (function,
  index, column all registered; 783 rows untouched) → **rolled-back live smoke
  on the busiest plan: 61→61 rows, a checked item survived regeneration, stamp
  correct** → zero residue (201 checked rows intact). Merged as `5450606`;
  branches cleaned up.
- **Milestones 2–4 are all live in prod.** Each shipped the same way: live-data
  preflights → migration + pgTAP first → local Colima proof → first-try green
  CI → owner-gated migration-first prod apply with a rolled-back smoke test →
  merge. Three PRs, three first-try green CI runs, zero prod incidents since
  the M2 deploy-order lesson.
- Next: milestone 5 (UI feedback and ergonomics), scoped by the 2026-06-11 UI
  audit — feedback/status overhaul, mobile ergonomics, loading polish.

## 2026-07-02 - Milestone 4 (Grocery State Preservation) Implemented and Locally Proven

- On `codex/grocery-state-preservation`: live preflights first (0 duplicate
  stripped identities across 783 rows → unique index safe; 18/19 plans' lists
  current → backfill scope). Migration `20260702023356`: additive
  `meal_plans.groceries_version` (staleness bookkeeping, backfilled where the
  list matches the current version), unique index on
  `(meal_plan_id, source_key)`, and `regenerate_grocery_list(p_plan_id)` — one
  transaction that normalizes legacy `v<n>|` keys, upserts fresh aggregates by
  the stable identity `name|unit|pantry` (DO UPDATE touches only amount +
  display name, so `is_checked` / `is_on_hand` / manual pantry overrides are
  preserved), deletes obsolete rows only after the upsert succeeds, and stamps
  `groceries_version = version` under the same plan-row lock milestone 3 uses.
- Grocery page: client-side fetch/build/delete/insert regeneration replaced by
  one RPC; staleness is now `groceries_version !== version` (the source-key
  prefix hack is gone); regen-loop guard added. `lib/grocery.ts` stays as the
  vitest-covered reference for the SQL's semantics.
- pgTAP suite #3 (25 assertions): aggregation math, state preservation through
  amount changes/removals/additions, legacy-row normalization with state
  intact, RLS rejection, empty-plan stamping. **Local proof: 108/108 across
  three suites**; typecheck, vitest 13/13, build green. Reviewed inline
  (ultracode off + spend-limit prudence) rather than via a multi-agent pass —
  the change is smaller than M3 and follows the twice-proven pattern.
- Remaining: PR → green CI → owner-gated prod apply (migration BEFORE client
  merge; old client stays compatible in the window) → merge → reliability core
  complete.

## 2026-07-02 - Milestone 3 (Plan Integrity) Implemented and Locally Proven

- On `codex/plan-integrity`, on the full rails: live-data preflights FIRST
  (142 items: all clean except 2 legitimate orphan leftovers, which shaped the
  design — NULL leftover links stay legal), then migration
  `20260702001350_plan_integrity.sql`: `validate_meal_plan_item` (date range,
  same-owner recipes, same-plan cook-sourced leftover links, protected cook
  items), `protect_plan_range` (no shrinking past items), and
  `bump_plan_version_on_grocery_change` — trigger-based, **grocery-scoped**
  version bumps (atomic `version + 1`; note/leftover/eat-out/date edits no
  longer wipe the grocery checklist). Client `bumpPlanVersion` and its 4 call
  sites removed (2 round trips saved per mutation); unsaved-dates guard added.
- Adversarial review (6 lenses, 24 findings; verifiers partially cut off by an
  org spend limit, surviving findings hand-verified): applied two write-skew
  row-lock fixes (`for no key update` on the plan read — FK `FOR KEY SHARE`
  does not conflict with non-key UPDATEs, so validation could race a
  range-shrink; `for share` on the leftover source read), extended the
  referenced-cook guard to block cross-plan moves, added the APPLY ORDER
  header (migration to prod BEFORE client merge — reverse creates a no-bump
  window = silently stale grocery lists), and +17 pgTAP assertions (cascade
  paths, hostile user, orphan re-touch, transitions). Refuted with evidence:
  the claim that trigger errors get swallowed (`PostgrestError` extends
  `Error`). Documented accepted non-issues: multi-plan deadlock surface,
  `updated_at` semantics, TRUNCATE bypass.
- The harness caught a real cross-milestone interaction on the first run: the
  new triggers changed the M2 suite's version arithmetic (its fixtures insert
  cook items) — 5 expectations updated with M3-aware values.
- **Verification:** fresh-from-migrations local stack → pgTAP **83/83**
  (plan_integrity 50, save_recipe 33); typecheck, vitest 13/13, build green.
- Remaining: PR → green CI → owner-gated prod apply (backup-first, migration
  before merge) → merge → milestone 4.

## 2026-07-01 (evening) - PR #3 Merged: First Green CI; Grants No-Op Applied; Milestones 1.5 + 2 Complete

- `gh` set up with both accounts (`2a-webteam` active machine-wide,
  `mitchthompson` pinned per command via `GH_TOKEN=$(gh auth token --user ...)`;
  SSH protocol so git credentials are untouched). Agent opened PR #3, watched
  checks, and merged on owner approval.
- **First fully green CI run:** app checks 46s; **DB tests (Supabase + pgTAP)
  1m02s, 33/33** — the service-exclusion list paid off. Milestone 1.5
  acceptance met.
- Merge `240b508`; Vercel redeployed `main` (CI/docs-only diff). Grants
  migration then applied to prod and **proven a no-op**: 210 grant rows
  byte-identical before/after. All migrations in `supabase/migrations/` are now
  applied to prod; feature branches deleted (local + remote).
- Milestones 1.5 and 2 are complete. Next: milestone 3 (plan integrity) on
  `codex/plan-integrity`, using the full rails: pgTAP first, local Colima
  proof, green CI, approved prod runbook.

## 2026-07-01 (later) - save_recipe Applied to Prod via Agent Runbook

- Owner provided scoped access: `.env.local` (session-pooler `DATABASE_URL`
  + anon key; verified read-only first) and a read-only Supabase MCP config
  (`.mcp.json`, OAuth, `read_only=true`). GitHub access: Option A chosen —
  `mitchthompson` added to `gh` as a secondary account, `2a-webteam` stays
  active machine-wide; agent pins the account per command with
  `GH_TOKEN=$(gh auth token --user mitchthompson)`.
- **Agent-executed prod runbook** (every step gated, all visible in
  transcript): `pg_dump` backup (98K, 10-table manifest verified, stored
  outside the repo) → preflights (no existing overload; counts
  27/264/141/138/19) → single-transaction apply of
  `20260627222320_atomic_recipe_save.sql` → function registered, counts
  unchanged → **rolled-back live smoke test** (real `save_recipe` call against
  prod returned a uuid, then rolled back; zero residue) → PostgREST probe
  initially `PGRST202`, refreshed within ~30s of `notify pgrst` to answer with
  the function's own auth-guard error (`P0001`), proving API registration.
  **Prod recipe-saving restored.**
- Security note confirmed in passing: functions default to PUBLIC execute, so
  anon can *call* `save_recipe`, but RLS rejects any anon write (no
  `auth.uid()`); a belt-and-suspenders `revoke execute ... from public` is a
  possible future hardening, not urgent.
- MCP server `dist/` rebuilt — the atomic RPC path is now what the import
  tool ships.
- Remaining: owner UI save confirmation; PR + first green CI for
  `codex/ci-grants-fix`; apply the grants migration to prod post-merge
  (verified no-op).

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
