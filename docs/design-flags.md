# Design Flags

Living register of open vs resolved questions and flags for Meal Queue.

Values are never guessed. A missing or unconfirmed value gets a flag here, not an invented value.

## Open

### One color literal evades the hex-grep guard (2026-07-05)
- **Where it's used:** `app/globals.css` (~line 1809): `box-shadow: 0 4px 12px rgba(31, 35, 31, 0.04)` on the mobile `.panel` override.
- **What's needed:** The house guard (`grep -E '#[0-9a-fA-F]{3,8}' app/globals.css` must hit `:root` only) does not catch `rgba()` values, so this literal — deliberately kept in the PR #19 token sweep as "an elevation cue, not a palette value" — is invisible to the guard. It is also a dark-mode hazard (a dark shadow on a dark bg disappears). Fix is folded into **milestone 14** ([plans/dark-mode.md](plans/dark-mode.md) §4a.3): tokenize as `--shadow-panel` in both schemes and extend verification to grep `rgba(` as well. It was the ONLY literal outside `:root` in the whole file, and no component `.tsx` carries inline colors (full-repo sweep 2026-07-05).
- **Source:** 2026-07-05 scoping-session research (token-system map).

### Recipe Import UI (PR 2, `codex/import-ui`) — unpinned CSS values (2026-07-04)
- **Where it's used:** `app/globals.css` (`.import-textarea`, `.import-progress`), documented in [design-system.md](design-system.md) Import surface.
- **What's needed:** Two values were not pinned on the round-5 board, so Phase C chose sensible defaults to flag for owner eyes on the as-built screenshots: (1) the paste-box `.import-textarea` **`min-height: 9rem`** (roomy enough for a full pasted recipe on a 390px phone without dominating the panel); (2) the indeterminate `.import-progress` sweep at **`1.1s` ease-in-out infinite** (`@keyframes import-progress-sweep`). Both are token/convention-consistent (no new palette). Adjust on owner feedback; otherwise they stand as the pinned values. `prefers-reduced-motion` disables the sweep.
- **Source:** Recipe Import Phase C build 2026-07-04, branch `codex/import-ui`; round-5 board (IM1/IM2) did not pin exact dimensions.

### Recipe Import (PR 1, `codex/import-api`) — Phase D outcome (2026-07-04)
- **Where it's used:** `lib/import/errors.ts`, `lib/import/fetch-page.ts`, `lib/import/schema.ts`, `app/api/import-recipe/route.ts`.
- **Deviation verdicts (owner + senior review, 2026-07-04):**
  1. **Em-dashes → periods in four error messages** (`text_too_long`, `unauthorized`, `llm_failure`, `llm_output_invalid`): **accepted, kept** (owner's no-em-dash-in-copy rule; wording otherwise verbatim).
  2. **`detectPaywall` takes the extracted text, not its length:** **accepted, kept** (the spec's `number` param cannot satisfy the "first 1500 chars" scan; behavior matches intent). The now-vestigial `hasJsonLd` param was also dropped (the sole caller only invokes it on the text path).
  3. **`assertSafeUrl` throws `fetch_failed` for unsafe URLs:** **accepted, kept** (not advertising the SSRF policy is the right posture; a blocked host reads as "couldn't fetch").
  4. **`DRAFT_JSON_SCHEMA` root-level `anyOf`:** **RESOLVED (2026-07-04 B13 smoke)** — the live Anthropic API accepted the non-object root and returned a valid draft (paste + URL paths both parsed). The `{result:{anyOf:[…]}}` wrapper fallback was not needed.
- **Code-review fixes applied this pass (all gate-green):** SSRF guard hardened (redirect targets now re-validated via `redirect:"manual"` + per-hop `assertSafeUrl`; IPv4-mapped IPv6 like `::ffff:127.0.0.1` resolved and blocked; `fe80::/10` masked correctly; FQDN-root `localhost.` blocked); `stripStepNumbering` no longer corrupts steps beginning with a numeric range ("3-4 minutes"); `normalizeAmount` reuses `roundAmount` from `lib/grocery.ts`; redundant paste-branch `.slice(25000)` removed.
- **Source:** Recipe Import Phase B build 2026-07-03 + Phase D review 2026-07-04; branch `codex/import-api`.

### Per-page docs are stubs
- **Where it's used:** [docs/pages/*.md](pages/) — [today](pages/today.md), [recipes](pages/recipes.md), [plans](pages/plans.md), [grocery](pages/grocery.md), [settings](pages/settings.md)
- **What's needed:** These are skeletons; flesh out as each page is worked. Update (2026-07-02): [settings](pages/settings.md) was rewritten with the v2 Settings pass (PR #20), and [recipes](pages/recipes.md) was de-rotted with the v2 Recipes/detail passes (PRs #21–#22 — it had still described pre-M2 non-atomic saves, the removed sample-data seeder, and the pre-reflow "focus mode"). [today](pages/today.md), [plans](pages/plans.md), and [grocery](pages/grocery.md) remain stubs (the redesign brief supersedes them for future-state intent).
- **Source:** Session decision (canonical context)

### Auth flow incomplete: no sign-up confirmation messaging, no password reset, unfriendly errors
- **Where it's used:** Auth UI (`components/auth-gate.tsx` and sign-up/sign-in flow)
- **What's needed:** If Supabase email confirmation is enabled, sign-up shows no feedback at all (no session returned, nothing rendered). There is no password-reset path, and auth errors are not user-friendly. Update (2026-07-05): split by owner verdict — the **password-reset flow is specced as milestone 11** ([plans/password-reset.md](plans/password-reset.md)); **friendlier auth errors are DONE (milestone 9, PR #33, 2026-07-05)** — `toAuthErrorMessage` in `lib/errors.ts` maps the common Supabase auth errors and passes other readable ones through, wired into `components/auth-gate.tsx`; and **sign-up confirmation messaging stays deferred indefinitely** (single household, accounts already provisioned). With M9 shipped, only **password reset (M11)** and the deferred sign-up-confirmation third remain open. Known constraint recorded in the M11 spec: the reset email opens in the default browser, not the installed standalone app (per-context sessions; accepted). **Update (2026-07-06): password reset is BUILT and verified on `codex/password-reset` (uncommitted, unmerged)** — forgot-password link + `requestPasswordReset` in `auth-gate.tsx`, new `/reset-password` route, board **AR1: A** (stacked `.auth-links`) shipped in code, `verify-reset-pass` 25/25. **Still open until it merges:** AR2 board sign-off, the Supabase-dashboard redirect URLs, and a prod real-device pass. Only the deferred sign-up-confirmation third stays open beyond that.
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Auth flow gaps, finding 6); also [roadmap](roadmap.md) Deferred Fixes (UI audit)

### Thin empty states, no dark mode (wake-lock resolved)
- **Where it's used:** New-user empty states across routes; global theming in [`app/globals.css`](../app/globals.css)
- **What's needed:** Update (2026-07-02): the wake-lock half is done — Cook mode (`components/cook-mode.tsx`, reflow screen 1) holds a screen wake-lock while active, re-acquired on `visibilitychange`. Still open: richer empty states for new users, and dark-mode support beyond the Cook takeover. Update (2026-07-05): both halves specced — **dark mode as milestone 14** ([plans/dark-mode.md](plans/dark-mode.md); system-follow only, slate set as the base, values board-gated) and **empty states as milestone 15** ([plans/empty-states.md](plans/empty-states.md); shared `EmptyState` component, four weak states). Closes when both ship.
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 15); also [roadmap](roadmap.md) Deferred Fixes (UI audit); [redesign-brief.md](redesign-brief.md)

### Cook mode: per-step ingredient chips use a name-match heuristic
- **Where it's used:** `components/cook-mode.tsx` (`matchesStep`)
- **What's needed:** The schema has no step↔ingredient association (`recipe_steps` and `ingredients` are independent children of `recipes`), so the mockup's "that step's ingredients as chips" is implemented by matching ingredient names against the step text (case-insensitive substring, tolerating a trailing plural `s`/`es`). Works for the household's recipe style but will miss renames/paraphrases ("the chicken") and can over-match short names. Owner to judge on real recipes: keep the heuristic, tune it, or (bigger) add a step↔ingredient link to the schema (schema change — needs its own approval and migration). Update (2026-07-02 review, round 1): owner verdict — the heuristic stays; the chips restyled to variant B (one muted text line), **shipped in PR #17**. Only the heuristic half of this flag remains open: judge match quality on real recipes over time (tune, or add a step↔ingredient link — schema change on the usual rails).
- **Source:** Session 2026-07-02 (reflow Cook build); [redesign-brief.md](redesign-brief.md) Cook section

### No automated coverage for Supabase write flows or UI interactions
- **Where it's used:** Test suite (Vitest); writes in `app/plans/page.tsx`, `app/recipes/page.tsx`, `app/grocery/page.tsx`
- **What's needed:** Automated tests currently protect date and grocery calculations only. Supabase write flows and UI interactions have no coverage, so regressions in save/regenerate/version logic are not caught. Needs test coverage for the write paths and key UI interactions (partially addressed as milestones land, but the gap is currently open). Update (2026-06-27): milestone 1.5 adds a pgTAP suite for `save_recipe` (atomicity, RLS, version bump) run in CI against an ephemeral local Supabase stack — closing this gap for the save path once CI runs; broader UI-interaction coverage stays open.
- **Source:** [current-state](current-state.md) (Known Reliability Risks)

## Resolved

### Five sequential round trips per plan mutation (no optimistic UI)
- **Resolution (2026-07-05, milestone 10 PR 2, PR #35 `1d16ef8`, deployed):**
  item-level mutations are now optimistic — local React state is patched before
  the network round trip and rolls back (targeted, per-item) on failure — and the
  plan/recipe form saves dropped their blocking refetches. Milestone 3 had already
  removed the two version round trips (2026-07-02); this closed the remaining
  latency by moving the UI ahead of the write. Affected `use-grocery-list.ts`
  (toggle/bucket/pantry/on-hand), `use-plan.ts` (adjustServing/removeItem/addMeal;
  keep the plan-version refresh, drop `loadPlanItems`), and `use-recipes.ts`
  (saveRecipe/deleteRecipe local list patch). Last-write-wins is accepted (single
  household); rollback is functional and per-item so concurrent patches are never
  clobbered. Proven by `verify-optimistic-pass.mjs` (16/16: <200ms render under a
  1500ms-delayed network, rollback + red error on abort). Spec
  [plans/responsiveness.md](plans/responsiveness.md) §4.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); [roadmap](roadmap.md) Deferred Fixes ("No optimistic UI")

### Plan version bumps fire for grocery-irrelevant changes (over-triggered regeneration)
- **Resolution (both halves now closed):** the **scoping half** was closed by
  milestone 3 (2026-07-02, `codex/plan-integrity`) — version bumps became a
  database trigger scoped to grocery-relevant changes only (cook items
  added/removed; recipe or serving multiplier changed), so
  note/leftover/eat-out/date edits no longer invalidate the checklist. The
  **silent-regeneration half** was closed by **milestone 10 PR 1 (2026-07-05, PR
  #34 `41fa28b`, deployed):** the grocery page no longer regenerates on load — a
  stale plan shows an amber banner + explicit Generate/Update button (SB1: A),
  the list stays usable while stale, and nothing writes until the button. Board
  pin SB1 signed off A (amber); `verify-shop-pass` 22/22 proves no regen fires on
  load. Spec [plans/responsiveness.md](plans/responsiveness.md) §3.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md); [roadmap](roadmap.md) milestones 3 & 10

### Raw Supabase error strings + no route-level error/loading boundaries
- **Resolution (2026-07-05, milestone 9, PR #33 `8f1cd46`, deployed):** Shipped
  root `app/error.tsx` / `app/global-error.tsx` / `app/not-found.tsx` /
  `app/loading.tsx` boundaries (standalone panels outside `AppShell`, since a
  crash may be in the shell), a recipe-detail 404 (`PGRST116` → render-time
  `notFound()`), and swept all 17 raw `setError(x.message)` sites (Settings,
  recipe detail, auth-gate, the plan/recipes/grocery hooks) through
  `toErrorMessage` (`toAuthErrorMessage` for sign-in). `toErrorMessage` still
  passes P0001/unknown messages through by design; the win is the code-mapped
  classes plus a guaranteed fallback. Board pin EB1 signed off, senior review
  clean, vitest 138/138, prod `/nonexistent` → 404 panel confirmed live.
  mini-M5's `lib/errors.ts` mapping + `aria-live` `StatusMessage` were the
  precursors. Supersedes the open flag.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md); resolved 2026-07-05 (milestone 9)

### Recipe Import IM6 — original-text storage (round-5 board)
- **Resolution (2026-07-04):** owner confirmed "IM6: OK" — keep as built. `instructions_raw` stores the imported text verbatim with a `Source: <url>` first line for URL imports (paste imports have no source line), not editable at review. It is the provenance record; the structured `recipe_steps` are the canonical instructions. No code change (matches the Phase B build).
- **Source:** Round-5 board verdicts, 2026-07-04; see [decisions.md](decisions.md).

### `mcp/` npm-audit findings (9: 2 moderate, 7 high)
- **Resolution (2026-07-03, direct to `main`):** All 9 were **transitive** (none of the four direct deps — `@modelcontextprotocol/sdk`, `@supabase/supabase-js`, `cheerio`, `zod` — were flagged). Resolved with an **in-range, lockfile-only `npm audit fix`** (9 → **0**; `package.json` unchanged), the same shape as the root `ws` fix: `undici`@7.28.0 (via cheerio), `ws`@8.21.0 (via supabase-js realtime), plus the MCP SDK's HTTP stack `hono`@4.12.27 / `@hono/node-server` / `express-rate-limit` / `path-to-regexp` / `qs` / `fast-uri` / `ip-address`. **Exposure was low regardless:** the server runs over **stdio** (`StdioServerTransport`), so the SDK's HTTP/SSE transport that pulls the 7 hono/express advisories is never instantiated — dead code; only `undici` (recipe-URL fetch) was a live surface. **Verification:** `npm audit` 0; `tsc` rebuild clean (`dist/` byte-identical, source untouched); the server loads over stdio and answers a real MCP `initialize` handshake (correct `serverInfo` + tools capability). Note: `mcp/` has no CI coverage (root CI doesn't build it, ESLint ignores `mcp/**`), so this was local-verify + direct-to-main.
- **Source:** flagged in the root-`ws` and MCP-save-recipe resolutions; resolved 2026-07-03

### schema.sql baseline/ALTER consolidation
- **Resolution (2026-07-03):** `schema.sql` interleaved baseline DDL with historical inline `ALTER`s (redundant `add column if not exists` for columns the CREATE already declared — `groceries_version`, `slot_type`, `leftover_from_item_id`, `note`, `is_on_hand`; a `recipe_id drop not null`; a legacy `drop index`; a `set slot_type='cook'` backfill; and two `add constraint` blocks). Cleaned so the file reads as a current-state snapshot: dropped the redundant/no-op statements and **folded the two substantive named CHECK constraints** (`meal_plan_items_slot_recipe_check`, `meal_plan_items_leftover_link_check`) into the `meal_plan_items` CREATE TABLE. Deliberately **not** moved into `migrations/` — these predate the forward-only directory and are already applied to prod; a canonical snapshot reflects state, not a changelog. schema.sql 735 → 699 lines. **Prod untouched** (schema.sql is a reference, never `db push`ed). **Proven schema-neutral:** built a fresh local DB from the old baseline and from the new, `pg_dump --schema-only` of both is byte-identical (only pg_dump 18's random `\restrict` session nonce differs); pgTAP 108/108; the baseline copy was regenerated so the new CI drift guard stays green.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md); resolved 2026-07-03

### Reflow round-1 board pins T1–T4 (Today), P1–P3 (Plan), S1–S2 (Shop): all defaults kept
- **Resolution (2026-07-03):** Owner signed off on every round-1 judgment-call default — no code changes. **T1** settings gear in the Today header (kept off the 4-tab bar); **T2** plan-less Today teal hero "Plan your week to get started" → `/plans` + recipes pointer; **T3** link hover stays v2 **amber** `#e8a13d` (`--brand-2`) — a flip back to teal (`--brand`) remains a one-line token change if it ever reads as two competing accents; **T4** desktop column capped at 640px (`.page-col`); **P1** inline collapsible edit panel (not a modal); **P2** "Generate grocery list" is a link to `/grocery` (Shop's staleness regen does the work on arrival); **P3** filter pills (Current/Upcoming/Past/All) + compact plan picker kept above the day rows; **S1** manual Regenerate ghost button kept as the escape hatch alongside auto-regen; **S2** On-hand section defaults collapsed. Supersedes the open "Today reflow judgment calls", "Plan reflow judgment calls", and "Shop reflow judgment calls" flags.
- **Source:** Round-1 review-board pins; owner verdicts 2026-07-03

### Cook mode: "Done — mark cooked" (C2) — stays a no-op exit for now
- **Resolution (2026-07-03):** Owner verdict — leave the last-step action as a takeover exit with no data write. No cooked/`cooked_at` state added; the schema is unchanged. Revisit only if a concrete consumer appears (e.g. Today's "tonight" logic or leftover suggestions), at which point adding cooked state is a schema change + migration on the usual rails (backup → preflight → apply → verify) — and the meaning of "cooked" for multi-night leftovers needs pinning down first. Supersedes the open "Cook mode: Done — mark cooked writes nothing" flag.
- **Source:** Session 2026-07-02 (reflow Cook build); owner verdict 2026-07-03

### ensureUserSettings duplicate call + default settings disagreed across files
- **Resolution:** Duplicate call fixed in mini-M5 (guarded session effect). Defaults single source of truth done 2026-07-03 (direct to `main`, merge `aada18f`): `DEFAULT_USER_SETTINGS` in `lib/constants.ts` mirrors the SQL column defaults (plan_days 7, week_starts_on 5, order/pickup weekday null); the four inline `{7,5,3,4}` copies (settings form `initialForm`, `ensureUserSettings` upsert, two spots in `use-plan.ts`) now reference it. Owner chose client-matches-SQL (null/unset) over codifying Wed/Thu as DB defaults, so no migration ran. Behavior: new users get unset order/pickup dates (they pick their own days); existing saved settings load from the DB, unaffected. `lib/date-utils.test.ts` keeps the 3/4 fixture (it tests the non-null weekday path, not a default).
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md); resolved 2026-07-03

### `AppShell` received `userEmail` from all six screens but never rendered it
- **Resolution (2026-07-03, direct to `main`, merge `aada18f`):** Owner chose remove over building an account/sign-out affordance. Dropped `userEmail` from `AppShellProps` and stopped threading it from the five screens that only forwarded it (Today, Plan, Shop, Recipes, recipe detail). Settings keeps its own `userEmail`: it renders the signed-in address itself (`{userEmail ?? "Signed in"}`). Verified: eslint 0 warnings, typecheck clean, vitest 16/16; residual grep confirms `userEmail` survives only where Settings renders it.
- **Source:** ESLint setup 2026-07-03; resolved 2026-07-03

### `npm audit` root high-severity `ws` advisory (was 3 high, docs once said 1)
- **Resolution (2026-07-03, direct to `main`, merge `aada18f`):** `npm audit fix` bumped the `@supabase/*` chain 2.95.3 -> 2.110.0 (inside the declared `^2.49.1` range), so newer `@supabase/realtime-js` drops the vulnerable `ws`. Lockfile-only, `package.json` unchanged; root `npm audit` went 3 high -> **0**. Not a major bump, so no owner-gated dependency upgrade beyond applying the fix. (`mcp/`'s own 9 findings were later resolved the same way — see the `mcp/` npm-audit entry above.)
- **Source:** Session 2026-06-27 baseline; resolved 2026-07-03

### `npm run lint` was non-functional (no ESLint config)
- **Where it was used:** `npm run lint` (was `next lint`); CI app-checks job
- **What was needed:** There was no ESLint config, so `next lint` (deprecated, removed in Next.js 16) dropped into an interactive setup wizard and could not run non-interactively (it would hang CI). The CI app-checks job deliberately omitted lint; the ask was an ESLint config, migration off `next lint` to the ESLint CLI, then a CI lint step.
- **Resolution (2026-07-03, `codex/eslint-ci`):** Migrated off `next lint` to the ESLint CLI. Added `eslint.config.mjs` (flat config: `next/core-web-vitals` + `next/typescript`, ignoring `mcp/**` — a separate package with its own build); `npm run lint` is now `eslint . --max-warnings=0` (zero-warning gate, local == CI); `next build` no longer lints (`eslint.ignoreDuringBuilds` in `next.config.mjs`) so the CLI step is the single gate; the CI app-checks job runs a dedicated Lint step. Installed devDeps `eslint`, `eslint-config-next`, `@eslint/eslintrc` (zero new audit findings — the 3 highs are the pre-existing `ws`/supabase chain). First run surfaced 7 problems: 3 errors in `mcp/dist` (out of scope → ignored) and 4 warnings (fixed: unused `userEmail` destructure in `AppShell`, and 3 dead `react-hooks/exhaustive-deps` disable directives). Tree is lint-clean at zero warnings; typecheck / vitest 16 / `next build` all green. The `userEmail` cleanup opened a standing flag (above).
- **Source:** Session 2026-06-27 baseline verification; resolved 2026-07-03

### Pre-reflow remnants: hardcoded cream values and un-swept screens (owner question, 2026-07-02)
- **Where it's used:** `app/globals.css` — the ≤700px `.panel` override (border `#e4d8c6`, background `rgba(255,253,248,.92)` — affects every mobile panel: Settings, the recipes list/editor, auth, plan sheets), `.recipe-view-section` (`#c9bba6`), `.recipe-meta` / `.recipe-step-item` (`#fffefb`), `.pantry-badge` (`#c9bba6`/`#f3eadc`/`#5e513d`), assorted literal `#fff`; plus the screens the reflow deliberately did not rebuild (Settings, Recipes library + editor, recipe detail, auth).
- **What's needed:** Owner asked (2026-07-02) whether a full sweep to the v2 look is planned — it was not on the roadmap; the reflow scoped only the four cycle screens and token set v2 landed at the token level. **Owner approved the two-part plan the same day (now roadmap milestone 7):** (1) a quick mechanical PR replacing every hardcoded old-palette value with v2 tokens (this alone de-creams Settings and the editor on mobile — those literals bypass the tokens, violating the no-hardcoded-values rule); (2) a "v2 sweep" round of per-screen passes in the reflow rhythm (Settings → Recipes library/editor → recipe detail; auth folds into the deferred auth-flow work) to bring layout language, not just colors, in line.
- **Update (2026-07-02, part 1 built on `codex/v2-token-sweep`):** all 20 literals in `app/globals.css` swapped to v2 tokens; the hex grep now hits `:root` definitions only. Mappings: cream borders `#e4d8c6`/`#c9bba6` → `var(--line)`; warm whites `#fffefb` + the mobile `.panel` translucent `rgba(255,253,248,.92)` → `var(--surface)` (panels are now opaque white on mobile, matching desktop; nothing overlaps them, so the lost translucency has no visible effect); all `#fff`/`#ffffff` → `var(--surface)` (computed-identical); old meta ink `#3d443d` → `var(--muted)`; `.pantry-badge` → the amber set (`--color-accent` border, `--color-accent-soft` bg, `--color-accent-deep` text, mirroring `.chip.active`'s pattern). The mobile `.panel` box-shadow (`rgba(31,35,31,.04)`) was deliberately kept — an elevation cue, not a palette value. Verified 2026-07-02 by driving Settings, Recipes list, the editor takeover, and recipe detail at 390px on the local stack: 22/22 computed-style assertions, a full-DOM scan finding zero retired values, no console errors. **Two calls for owner eyes with the part-2 screenshots:** the pantry badge now has a visible amber outline (was muted tan), and mobile panels are opaque white (was translucent cream). One quirk found while verifying, left as-is for mechanical parity: on recipe detail, `.recipe-meta span` (specificity 0-1-1) overrides the badge's own text color/size (0-1-0) — true pre-sweep too (the badge never rendered its `#5e513d`; it rendered `#3d443d`, now `var(--muted)`) — so badge text is muted gray on the amber-soft fill until the part-2 recipe-detail pass restyles it. Part 2 (per-screen layout passes) remains open.
- **Update (2026-07-02, round-2 verdicts + Settings pass):** part 1 merged and deployed (PR #19). Owner verdicts on the round-2 board: **V1 keep** (amber badge outline stays) and **V2 fine** (opaque mobile panels) — both resolved. Settings built on `codex/v2-settings` per **ST1: B** (iOS-style rows: label left, control right, hairline dividers), **ST2: full-width** teal save, **ST3: yes** (page title + uppercase card labels); behavior-neutral, 44px controls. Remaining in part 2: Recipes library + editor → recipe detail (which also resolves the badge text-color cascade quirk noted above).
- **Source:** Owner question + approval, 2026-07-02 review session; hardcoded values confirmed by grep the same day; round-2 verdicts 2026-07-02 ("they all look good", direction delegated)
- **Resolution (2026-07-02, evening):** Milestone 7 complete — Recipes library + editor shipped per round-3 verdicts (PR #21: A cards without the serves line, header language + teal links, sample-data seeder removed outright, stacked editor, full-width save) and recipe detail per round-4 verdicts (PR #22: flat hairline rows on both lists, full-width Start cooking, header language + 44px stepper, RD5 breadcrumb + one-row actions). The badge text-color cascade quirk was fixed at the root in PR #22 (`.recipe-meta span` retired in favor of `.recipe-amount`, so `.pantry-badge` finally renders its amber text). Auth remains excluded by design (folds into the deferred auth-flow work).

### Plan: drop the lunch/dinner division (owner request, round 1)
- **Resolution (2026-07-02):** Shipped in PR #18 (`codex/plan-flat-days`).
  Every Plan day is one flat meal list in added order; quick-add is per-day.
  `meal_type` remains in the schema as a vestigial NOT NULL column — new rows
  write `'dinner'`, nothing reads it, no migration ran (see
  [data-model.md](data-model.md)). Today's hero headlines the first cook
  meal and shows a second as "Also tonight" with a "+N more" overflow; the
  week peek dropped its meal-type sublabels. Dropping the column for real is
  a possible future migration, deliberately not scheduled.

### Plan quick-add: recipe search is weak on mobile (owner request, round 1)
- **Resolution (2026-07-02):** Shipped in PR #18 with the flat-day rework:
  44px tap rows with serves count, most-recently-planned recipes listed
  before any typing (soft recency query over `meal_plan_items`, degrades to
  name order on error), Enter/Shift+Enter kept for desktop with the hint
  hidden on touch devices (`@media (hover: none)`).

### Recipes: editor stacks below the full list on mobile (owner request, round 1)
- **Resolution (2026-07-02):** Shipped in PR #17. On ≤700px the open editor
  replaces the list ("‹ Back to recipes"; opening scrolls to the form top);
  desktop keeps the side-by-side split. Subsumed the deferred mini-M5
  "scroll-into-view when the editor opens" item.

### Dashboard can render an empty current week
- **Resolution (2026-07-02):** Fixed by the reflow's Today screen
  (`lib/hooks/use-today.ts`): items load for the date-relevant current plan
  (active by date range, else soonest upcoming) and its successor — never a
  "newest 4" window — so the active week can no longer be silently excluded.
  A past-only history now intentionally renders the plan-less state rather
  than resurrecting a finished plan.

### Duplicated code: formatDisplayDate and lunch/dinner columns
- **Resolution (2026-07-02):** Both halves done. `formatDisplayDate`
  centralized in `lib/date-utils.ts` (M6 slice 1, PR #7). The lunch/dinner
  slot cells unified into `components/plan-slot-cell.tsx` (M6 slice 4,
  PR #12) — plans page 571 → 266 lines, behavior-neutral (mechanical-diff
  verified; the nth-child label coupling was preserved and remains its own
  open flag above).

### Design source of truth
- **Resolution:** No external Figma. In-repo is authoritative: [`supabase/schema.sql`](../supabase/schema.sql) (data) + [`app/globals.css`](../app/globals.css) tokens + [design-system](design-system.md) (UI) + [docs/pages/*.md](pages/) (page intent).

### CSS namespace prefix
- **Resolution:** No class prefix. The CSS-variable token system in [`app/globals.css`](../app/globals.css) is the namespace; no raw hex/spacing in components.

### Doc-system reconciliation
- **Resolution:** Existing UPPERCASE docs migrated to lowercase-kebab canonical names (single source of truth); net-new docs added ([CLAUDE.md](../CLAUDE.md), [design-system](design-system.md), [design-flags](design-flags.md), [routes](routes.md), [data-model](data-model.md), [pages/*](pages/)).

### Session-end verification commands
- **Resolution:** `npm run lint` + `npm run typecheck` + `npm run test` every session; `npm run build` when shipping a build-affecting change. See [qa](qa.md).

### MCP save-recipe tool non-atomic insert sequence
- **Resolution (2026-07-01):** The tool was switched to the `save_recipe` RPC (service-role path via `p_user_id`), the migration was applied to prod the same day, and `mcp/dist/` was rebuilt — the MCP path is now atomic end to end. (`mcp/`'s 9 npm-audit findings were resolved separately 2026-07-03 — see the `mcp/` npm-audit entry above.)

### Vercel deploy trigger
- **Resolution (2026-07-01):** Confirmed by observation — merging PR #2 to `main` auto-deployed production on Vercel, and branch pushes produce preview deployments. `main` is the production branch; there is no manual promote step. Every merge to `main` is therefore a release: the deploy-order rule (apply DB migrations **before** merging dependent client code) is mandatory, not theoretical — this is exactly how the `save_recipe` client reached prod ahead of its function.

### `supabase/config.toml` `major_version` vs prod
- **Resolution (2026-07-01):** Prod is Postgres **17.6** (owner ran `SHOW server_version;`). `config.toml` `major_version` set to 17, so CI/local tests run the same engine as prod. Re-confirm only if the Supabase project is ever upgraded. (Not exposed via the REST API — the dashboard/SQL editor is the way to check.)
