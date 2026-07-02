# Design Flags

Living register of open vs resolved questions and flags for Meal Queue.

Values are never guessed. A missing or unconfirmed value gets a flag here, not an invented value.

## Open

### Per-page docs are stubs
- **Where it's used:** [docs/pages/*.md](pages/) — [dashboard](pages/dashboard.md), [recipes](pages/recipes.md), [plans](pages/plans.md), [grocery](pages/grocery.md), [settings](pages/settings.md)
- **What's needed:** These are skeletons; flesh out during milestone 5 (UI feedback & ergonomics) as each page is worked.
- **Source:** Session decision (canonical context)

### Dashboard can render an empty current week
- **Where it's used:** `app/page.tsx` (`loadDashboard`)
- **What's needed:** Meal items and grocery previews load only for the 4 plans with the newest `start_date`. With 4 or more future plans, the current plan falls outside that window and the dashboard silently shows nothing. Fix the query to always include the current/active plan (e.g., select by date range covering today rather than top-4-by-`start_date`), or load the current week independently of the upcoming-plans window.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, notable); also [roadmap](roadmap.md) Deferred Fixes and [current-state](current-state.md) Known Reliability Risks

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

### Mobile Lunch/Dinner labels rely on nth-child CSS coupling
- **Where it's used:** [`app/globals.css`](../app/globals.css) (nth-child `::before` label injection) coupled to the plan-grid row markup, now rendered by `components/plan-slot-cell.tsx` inside `app/plans/page.tsx`
- **What's needed:** Mobile Lunch/Dinner labels are injected via nth-child `::before` pseudo-elements, coupling the stylesheet to markup child order (fragile if markup reorders). Needs the labels driven by markup/data rather than child-order CSS. Update (2026-07-02): deliberately left unchanged by M6 slice 4 (strict behavior neutrality, owner call); the markup now has a single edit site — `components/plan-slot-cell.tsx`, whose header documents the constraint. Candidate for the reflow's Plan screen.
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 13); also [roadmap](roadmap.md) Deferred Fixes (UI audit)

### Thin empty states, no dark mode (wake-lock resolved)
- **Where it's used:** New-user empty states across routes; global theming in [`app/globals.css`](../app/globals.css)
- **What's needed:** Update (2026-07-02): the wake-lock half is done — Cook mode (`components/cook-mode.tsx`, reflow screen 1) holds a screen wake-lock while active, re-acquired on `visibilitychange`. Still open: richer empty states for new users, and dark-mode support beyond the Cook takeover (deferred per the brief; Cook's `--color-cook-*` palette is a head start).
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 15); also [roadmap](roadmap.md) Deferred Fixes (UI audit); [redesign-brief.md](redesign-brief.md)

### Cook mode: per-step ingredient chips use a name-match heuristic
- **Where it's used:** `components/cook-mode.tsx` (`matchesStep`)
- **What's needed:** The schema has no step↔ingredient association (`recipe_steps` and `ingredients` are independent children of `recipes`), so the mockup's "that step's ingredients as chips" is implemented by matching ingredient names against the step text (case-insensitive substring, tolerating a trailing plural `s`/`es`). Works for the household's recipe style but will miss renames/paraphrases ("the chicken") and can over-match short names. Owner to judge on real recipes: keep the heuristic, tune it, or (bigger) add a step↔ingredient link to the schema (schema change — needs its own approval and migration).
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
