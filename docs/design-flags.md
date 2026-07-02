# Design Flags

Living register of open vs resolved questions and flags for Meal Queue.

Values are never guessed. A missing or unconfirmed value gets a flag here, not an invented value.

## Open

### Per-page docs are stubs
- **Where it's used:** [docs/pages/*.md](pages/) — [today](pages/today.md), [recipes](pages/recipes.md), [plans](pages/plans.md), [grocery](pages/grocery.md), [settings](pages/settings.md)
- **What's needed:** These are skeletons; flesh out as each page is worked. Update (2026-07-02): [settings](pages/settings.md) was rewritten with the v2 Settings pass (PR #20), and [recipes](pages/recipes.md) was de-rotted with the v2 Recipes/detail passes (PRs #21–#22 — it had still described pre-M2 non-atomic saves, the removed sample-data seeder, and the pre-reflow "focus mode"). [today](pages/today.md), [plans](pages/plans.md), and [grocery](pages/grocery.md) remain stubs (the redesign brief supersedes them for future-state intent).
- **Source:** Session decision (canonical context)

### Today reflow judgment calls (settings gear, plan-less state, amber hover, desktop width)
- **Where it's used:** `app/page.tsx`, `components/app-shell.tsx`, `app/globals.css`
- **What's needed:** Owner sign-off on four defaults chosen while building Today (the mockup doesn't specify them): (1) **Settings access** moved off the tabbar (mockup shows a 4-tab bar with no settings entry) to a gear icon in the Today header — confirm placement; (2) **plan-less Today** (first run / gap weeks — the brief's open question) renders a teal hero "Plan your week to get started" → `/plans` plus a recipes pointer card; (3) `--brand-2` (link hover) now resolves to the v2 **amber** `#e8a13d` since terracotta retired — hover may want to stay teal instead; (4) desktop Today constrains the column to **640px** (`.page-col`).
- **Source:** Session 2026-07-02 (reflow Today build); [redesign-brief.md](redesign-brief.md) open questions

### Shop reflow judgment calls (Regenerate button kept, on-hand collapsed)
- **Where it's used:** `app/grocery/page.tsx`
- **What's needed:** Owner sign-off on two defaults from the Shop reflow: (1) the brief's open question "keep manual Regenerate, or trust staleness entirely?" — the **Regenerate button was kept** (small ghost button in the header) since auto-regeneration already runs on staleness and the button is the manual escape hatch; drop it once trusted. (2) The **On hand** section now defaults to collapsed (previously expanded) — it's post-purchase bookkeeping, not shopping. Also: the old always-visible plan sidebar became a compact plan picker shown only when more than one active/future plan exists.
- **Source:** Session 2026-07-02 (reflow Shop build); [redesign-brief.md](redesign-brief.md) open questions

### Plan version bumps fire for grocery-irrelevant changes (over-triggered regeneration)
- **Where it's used:** `app/plans/page.tsx` / `app/grocery/page.tsx`
- **What's needed:** Update (2026-07-02): milestone 3 (on `codex/plan-integrity`) resolves the scoping half at the root — version bumps are now a database trigger scoped to grocery-relevant changes only (cook items added/removed; recipe or serving multiplier changed), so note/leftover/eat-out/date edits no longer invalidate the checklist. Remaining open (milestone 4/5 scope): the grocery page still regenerates silently on load rather than prompting.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md); [roadmap](roadmap.md) milestone 3

### Five sequential round trips per plan mutation (no optimistic UI)
- **Where it's used:** `app/plans/page.tsx` (plan mutation flow)
- **What's needed:** Each plan mutation did insert, version read, version write, item reload, and plan reload sequentially, making planning sluggish on iPhone Safari (a primary target). Update (2026-07-02): milestone 3's trigger-based versioning removed the two version round trips (now insert + item reload + plan reload). Optimistic UI updates remain deferred (milestone 5).
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes ("No optimistic UI")

### ensureUserSettings runs twice per sign-in and default settings disagree across files
- **Where it's used:** `components/auth-gate.tsx` (`ensureUserSettings`); default values duplicated across three client files vs [`supabase/schema.sql`](../supabase/schema.sql)
- **What's needed:** Update (2026-07-02): the duplicate call is fixed (mini-M5) — `ensureUserSettings` now runs once per sign-in via the guarded session effect. Still open: default settings values are duplicated in three files and disagree with the SQL defaults (DB: null order/pickup weekdays; client: 3/4) — needs a single source of truth. Split out of M6 as its own follow-up (owner decision, 2026-07-02); not yet scheduled. See [data model](data-model.md).
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes and [current-state](current-state.md) Known Reliability Risks

### Raw Supabase error strings render in the UI; no route-level error or loading boundaries
- **Where it's used:** UI route components (`app/*`, e.g. `app/plans/page.tsx`, `app/recipes/page.tsx`, `app/grocery/page.tsx`)
- **What's needed:** Update (2026-07-02): mini-M5 added `lib/errors.ts` (friendly mapping for common constraint/permission codes; our own P0001 trigger messages pass through — they are written to be human-readable) and an `aria-live` `StatusMessage` component adopted across all screens. Still open: route-level `error.tsx` / `loading.tsx` boundaries, and unmapped errors still surface raw messages.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes

### schema.sql mixes baseline DDL with historical inline ALTER migrations
- **Where it's used:** [`supabase/schema.sql`](../supabase/schema.sql)
- **What's needed:** The canonical schema file interleaves baseline DDL with historical inline ALTER statements, making the canonical schema hard to read. Needs the baseline DDL consolidated/cleaned so `schema.sql` reflects the current canonical schema, with historical ALTERs moved into the forward-only migrations directory.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes

### Auth flow incomplete: no sign-up confirmation messaging, no password reset, unfriendly errors
- **Where it's used:** Auth UI (`components/auth-gate.tsx` and sign-up/sign-in flow)
- **What's needed:** If Supabase email confirmation is enabled, sign-up shows no feedback at all (no session returned, nothing rendered). There is no password-reset path, and auth errors are not user-friendly. Needs sign-up confirmation messaging, a password-reset flow, and friendlier auth error handling. Explicitly deferred (out of milestone 5 scope).
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Auth flow gaps, finding 6); also [roadmap](roadmap.md) Deferred Fixes (UI audit)

### Plan reflow judgment calls (sheets, generate exit, filters kept)
- **Where it's used:** `app/plans/page.tsx`, `components/plan-day-items.tsx`
- **What's needed:** Owner sign-off on defaults from the Plan reflow: (1) the mockup's "edit sheet" is an inline collapsible panel toggled from the header (New plan / Edit plan), not a modal overlay; (2) "Generate grocery list" is a link to `/grocery` — Shop's staleness-driven regeneration does the actual generating on arrival; (3) the plan filter pills (Current/Upcoming/Past/All) and the compact plan picker were kept above the day rows (the mockup shows a single plan only). Update (2026-07-02, round 1): the fourth question (multi-item slot rendering) was superseded by the owner-requested flat-day rework — every day is now a stacked meal list with one "+ add another meal" line (PR #18); pins P1–P3 remain open.
- **Source:** Session 2026-07-02 (reflow Plan build); [redesign-brief.md](redesign-brief.md) open questions

### Thin empty states, no dark mode (wake-lock resolved)
- **Where it's used:** New-user empty states across routes; global theming in [`app/globals.css`](../app/globals.css)
- **What's needed:** Update (2026-07-02): the wake-lock half is done — Cook mode (`components/cook-mode.tsx`, reflow screen 1) holds a screen wake-lock while active, re-acquired on `visibilitychange`. Still open: richer empty states for new users, and dark-mode support beyond the Cook takeover (deferred per the brief; the v2 `--color-slate-*` set is a head start).
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 15); also [roadmap](roadmap.md) Deferred Fixes (UI audit); [redesign-brief.md](redesign-brief.md)

### Cook mode: per-step ingredient chips use a name-match heuristic
- **Where it's used:** `components/cook-mode.tsx` (`matchesStep`)
- **What's needed:** The schema has no step↔ingredient association (`recipe_steps` and `ingredients` are independent children of `recipes`), so the mockup's "that step's ingredients as chips" is implemented by matching ingredient names against the step text (case-insensitive substring, tolerating a trailing plural `s`/`es`). Works for the household's recipe style but will miss renames/paraphrases ("the chicken") and can over-match short names. Owner to judge on real recipes: keep the heuristic, tune it, or (bigger) add a step↔ingredient link to the schema (schema change — needs its own approval and migration). Update (2026-07-02 review, round 1): owner verdict — the heuristic stays; the chips restyled to variant B (one muted text line), **shipped in PR #17**. Only the heuristic half of this flag remains open: judge match quality on real recipes over time (tune, or add a step↔ingredient link — schema change on the usual rails).
- **Source:** Session 2026-07-02 (reflow Cook build); [redesign-brief.md](redesign-brief.md) Cook section

### Cook mode: "Done — mark cooked" writes nothing
- **Where it's used:** `components/cook-mode.tsx` (last-step primary action)
- **What's needed:** The brief's open question "any data write behind mark cooked?" is unanswered: no cooked/`cooked_at` state exists anywhere in [`supabase/schema.sql`](../supabase/schema.sql), so the button currently just exits the takeover. If the owner wants cooked state (e.g. for Today's "tonight" logic or leftover suggestions), that is a schema change + migration on the usual rails. Decide when Today is built, since Today is the consumer.
- **Source:** Session 2026-07-02 (reflow Cook build); [redesign-brief.md](redesign-brief.md) open questions

### No automated coverage for Supabase write flows or UI interactions
- **Where it's used:** Test suite (Vitest); writes in `app/plans/page.tsx`, `app/recipes/page.tsx`, `app/grocery/page.tsx`
- **What's needed:** Automated tests currently protect date and grocery calculations only. Supabase write flows and UI interactions have no coverage, so regressions in save/regenerate/version logic are not caught. Needs test coverage for the write paths and key UI interactions (partially addressed as milestones land, but the gap is currently open). Update (2026-06-27): milestone 1.5 adds a pgTAP suite for `save_recipe` (atomicity, RLS, version bump) run in CI against an ephemeral local Supabase stack — closing this gap for the save path once CI runs; broader UI-interaction coverage stays open.
- **Source:** [current-state](current-state.md) (Known Reliability Risks)

### `npm run lint` is non-functional (no ESLint config)
- **Where it's used:** `npm run lint` (= `next lint`); CI app-checks job
- **What's needed:** There is no ESLint config in the repo, so `next lint` (deprecated, removed in Next.js 16) drops into an interactive setup wizard and cannot run non-interactively (it would hang in CI). The CI app-checks job deliberately omits lint for now. Needs an ESLint config (and migration off the deprecated `next lint` to the ESLint CLI), then re-add a lint step to CI.
- **Source:** Session 2026-06-27 baseline verification

### `npm audit` reports 1 high-severity vulnerability (docs previously said zero)
- **Where it's used:** dependency tree (reported by `npm ci`)
- **What's needed:** `npm ci` reports 1 high-severity vulnerability; the reliability foundation (2026-06-11) had brought `npm audit` to zero, so this was likely disclosed since. Triage and patch within the major version (no dependency upgrade without owner approval). Untouched this session.
- **Source:** Session 2026-06-27 baseline verification

## Resolved

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
- **Resolution (2026-07-01):** The tool was switched to the `save_recipe` RPC (service-role path via `p_user_id`), the migration was applied to prod the same day, and `mcp/dist/` was rebuilt — the MCP path is now atomic end to end. Still open separately: `mcp/` has 9 npm-audit findings of its own (2 moderate, 7 high) — triage before heavy MCP use.

### Vercel deploy trigger
- **Resolution (2026-07-01):** Confirmed by observation — merging PR #2 to `main` auto-deployed production on Vercel, and branch pushes produce preview deployments. `main` is the production branch; there is no manual promote step. Every merge to `main` is therefore a release: the deploy-order rule (apply DB migrations **before** merging dependent client code) is mandatory, not theoretical — this is exactly how the `save_recipe` client reached prod ahead of its function.

### `supabase/config.toml` `major_version` vs prod
- **Resolution (2026-07-01):** Prod is Postgres **17.6** (owner ran `SHOW server_version;`). `config.toml` `major_version` set to 17, so CI/local tests run the same engine as prod. Re-confirm only if the Supabase project is ever upgraded. (Not exposed via the REST API — the dashboard/SQL editor is the way to check.)
