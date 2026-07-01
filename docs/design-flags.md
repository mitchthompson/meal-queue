# Design Flags

Living register of open vs resolved questions and flags for Meal Queue.

Values are never guessed. A missing or unconfirmed value gets a flag here, not an invented value.

## Open

### Vercel deploy trigger
- **Where it's used:** Vercel project / hosting
- **What's needed:** Confirm whether `main` auto-deploys on push, which branch is the production branch, and whether a manual promote/preview step exists. Currently an assumption. See [architecture](architecture.md).
- **Source:** Session decision (canonical context)

### Per-page docs are stubs
- **Where it's used:** [docs/pages/*.md](pages/) — [dashboard](pages/dashboard.md), [recipes](pages/recipes.md), [plans](pages/plans.md), [grocery](pages/grocery.md), [settings](pages/settings.md)
- **What's needed:** These are skeletons; flesh out during milestone 5 (UI feedback & ergonomics) as each page is worked.
- **Source:** Session decision (canonical context)

### Dashboard can render an empty current week
- **Where it's used:** `app/page.tsx` (`loadDashboard`)
- **What's needed:** Meal items and grocery previews load only for the 4 plans with the newest `start_date`. With 4 or more future plans, the current plan falls outside that window and the dashboard silently shows nothing. Fix the query to always include the current/active plan (e.g., select by date range covering today rather than top-4-by-`start_date`), or load the current week independently of the upcoming-plans window.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, notable); also [roadmap](roadmap.md) Deferred Fixes and [current-state](current-state.md) Known Reliability Risks

### Plan version bumps fire for grocery-irrelevant changes (over-triggered regeneration)
- **Where it's used:** `app/plans/page.tsx` (`bumpPlanVersion` / plan mutations) and `app/grocery/page.tsx` (`loadGroceryItems`)
- **What's needed:** Every plan mutation bumps the version, including changes with no grocery effect (eating-out notes, leftover servings). The grocery page detects the stale version on load and regenerates silently, wiping the shopping checklist on a minor tweak. Milestone 4 makes the wipe harmless to user state, but two open items remain: scope the version bumps so only grocery-affecting changes bump, and prompt the user before regenerating rather than regenerating silently on load.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, notable); also [roadmap](roadmap.md) Deferred Fixes and [current-state](current-state.md) Known Reliability Risks

### Five sequential round trips per plan mutation (no optimistic UI)
- **Where it's used:** `app/plans/page.tsx` (plan mutation flow)
- **What's needed:** Each plan mutation does insert, version read, version write, item reload, and plan reload sequentially, making planning sluggish on iPhone Safari (a primary target). Milestone 3's trigger-based versioning removes two of these round trips, but optimistic updates remain deferred. Needs optimistic UI updates so mutations feel responsive on mobile.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes ("No optimistic UI")

### ensureUserSettings runs twice per sign-in and default settings disagree across files
- **Where it's used:** `components/auth-gate.tsx` (`ensureUserSettings`); default values duplicated across three client files vs [`supabase/schema.sql`](../supabase/schema.sql)
- **What's needed:** `ensureUserSettings` is called once after the auth call and again from the session effect. Separately, default settings values are duplicated in three files and disagree with the SQL defaults (DB: null order/pickup weekdays; client: 3/4). Needs deduplication of the call (single invocation per sign-in) and a single source of truth for default settings that matches the SQL defaults. See [data model](data-model.md).
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes and [current-state](current-state.md) Known Reliability Risks

### Raw Supabase error strings render in the UI; no route-level error or loading boundaries
- **Where it's used:** UI route components (`app/*`, e.g. `app/plans/page.tsx`, `app/recipes/page.tsx`, `app/grocery/page.tsx`)
- **What's needed:** Raw Supabase error strings are shown directly to users, and there are no route-level error or loading boundaries. Needs friendly error mapping/handling and Next.js route-level `error.tsx` / `loading.tsx` boundaries.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes

### schema.sql mixes baseline DDL with historical inline ALTER migrations
- **Where it's used:** [`supabase/schema.sql`](../supabase/schema.sql)
- **What's needed:** The canonical schema file interleaves baseline DDL with historical inline ALTER statements, making the canonical schema hard to read. Needs the baseline DDL consolidated/cleaned so `schema.sql` reflects the current canonical schema, with historical ALTERs moved into the forward-only migrations directory.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (New Findings, minor); also [roadmap](roadmap.md) Deferred Fixes

### MCP save-recipe tool uses the same non-atomic insert sequence
- **Where it's used:** `mcp/` recipe-import server (save-recipe tool)
- **What's needed:** ~~The MCP save-recipe tool uses the same non-atomic insert sequence as the app.~~ Update (2026-07-01): the tool is switched to the `save_recipe` RPC on `codex/atomic-recipe-saves` (service-role path via `p_user_id`). Remaining to resolve: apply the `20260627222320_atomic_recipe_save.sql` migration to prod **before** rebuilding/using the MCP server (`cd mcp && npm run build`) — until then the shipped `dist/` still runs the old non-atomic code, which is the correct interim state. Also noted: `mcp/` has 9 npm-audit findings of its own (2 moderate, 7 high) — triage separately.
- **Source:** [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) (Repository and tooling); also [roadmap](roadmap.md) Milestone 2

### Auth flow incomplete: no sign-up confirmation messaging, no password reset, unfriendly errors
- **Where it's used:** Auth UI (`components/auth-gate.tsx` and sign-up/sign-in flow)
- **What's needed:** If Supabase email confirmation is enabled, sign-up shows no feedback at all (no session returned, nothing rendered). There is no password-reset path, and auth errors are not user-friendly. Needs sign-up confirmation messaging, a password-reset flow, and friendlier auth error handling. Explicitly deferred (out of milestone 5 scope).
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Auth flow gaps, finding 6); also [roadmap](roadmap.md) Deferred Fixes (UI audit)

### Mobile Lunch/Dinner labels rely on nth-child CSS coupling
- **Where it's used:** [`app/globals.css`](../app/globals.css) (nth-child `::before` label injection) coupled to plan grid markup in `app/plans/page.tsx`
- **What's needed:** Mobile Lunch/Dinner labels are injected via nth-child `::before` pseudo-elements, coupling the stylesheet to markup child order (fragile if markup reorders). Needs the labels driven by markup/data rather than child-order CSS. Slated to fit milestone 6 (component hardening) but currently deferred.
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 13); also [roadmap](roadmap.md) Deferred Fixes (UI audit)

### Duplicated code: formatDisplayDate and lunch/dinner columns
- **Where it's used:** `formatDisplayDate` duplicated in four files; lunch/dinner columns ~330 duplicated lines in `app/plans/page.tsx` (also flagged in CODE_AUDIT as ~1,100-line plans component with near-duplicate columns)
- **What's needed:** `formatDisplayDate` is duplicated across four files, and the lunch/dinner columns are ~330 near-identical lines. Needs shared date helpers centralized and the duplicated columns extracted into a reusable component. Targeted by milestone 6 (component hardening) but currently deferred.
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 14); also [CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) risk 6 (oversized route components)

### No screen wake-lock during cooking focus mode, thin empty states, no dark mode
- **Where it's used:** Recipe detail focus mode and new-user empty states across routes; global theming in [`app/globals.css`](../app/globals.css)
- **What's needed:** Nice-to-have polish that is deferred: acquire a screen wake-lock while the cooking step-by-step focus mode is active, provide richer empty states for new users, and add dark-mode support. Needs implementation when prioritized.
- **Source:** [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md) (Polish and structural notes, finding 15); also [roadmap](roadmap.md) Deferred Fixes (UI audit)

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

### Design source of truth
- **Resolution:** No external Figma. In-repo is authoritative: [`supabase/schema.sql`](../supabase/schema.sql) (data) + [`app/globals.css`](../app/globals.css) tokens + [design-system](design-system.md) (UI) + [docs/pages/*.md](pages/) (page intent).

### CSS namespace prefix
- **Resolution:** No class prefix. The CSS-variable token system in [`app/globals.css`](../app/globals.css) is the namespace; no raw hex/spacing in components.

### Doc-system reconciliation
- **Resolution:** Existing UPPERCASE docs migrated to lowercase-kebab canonical names (single source of truth); net-new docs added ([CLAUDE.md](../CLAUDE.md), [design-system](design-system.md), [design-flags](design-flags.md), [routes](routes.md), [data-model](data-model.md), [pages/*](pages/)).

### Session-end verification commands
- **Resolution:** `npm run lint` + `npm run typecheck` + `npm run test` every session; `npm run build` when shipping a build-affecting change. See [qa](qa.md).

### `supabase/config.toml` `major_version` vs prod
- **Resolution (2026-07-01):** Prod is Postgres **17.6** (owner ran `SHOW server_version;`). `config.toml` `major_version` set to 17, so CI/local tests run the same engine as prod. Re-confirm only if the Supabase project is ever upgraded. (Not exposed via the REST API — the dashboard/SQL editor is the way to check.)
