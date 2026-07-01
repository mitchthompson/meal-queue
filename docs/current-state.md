# Current State

Last reviewed: 2026-06-27

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

> Doc-system note: this session migrated the documentation set from the old
> UPPERCASE filenames to the lowercase-kebab system. All internal links below
> point at the new names (e.g. [data-model.md](data-model.md),
> [roadmap.md](roadmap.md)). The dated audit artifacts
> ([CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md),
> [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md)) keep their original names.

## Current build phase

**Reliability core.** **Milestone 2 (atomic recipe saves) is merged to `main`
(PR #2, `061f541`) and deployed on Vercel.** The `save_recipe` DB migration is
being hand-applied to prod (backup-first); until it lands, prod recipe-saves
error (everything else works). Milestone 1.5 (CI + pgTAP harness) is in: the
suite is proven locally (33/33 on a fresh PG17 stack) and its first CI failure
was root-caused to missing explicit Data API grants — fix on
`codex/ci-grants-fix`, awaiting push/PR. The local Supabase stack now runs on
Colima, so DB changes are provable locally before prod. Existing household data
is live and must stay compatible throughout. See [roadmap.md](roadmap.md).

## Stable Baseline

- **Last completed work:** Front-end UI audit documented and roadmap
  milestone 5 added as `117a660`, following the reliability foundation and
  code audit merges (`7cfbab2`, `e13f158`). GitHub CLI is not installed, so the
  owner approved merging the reviewed branches locally instead of through web
  pull requests.
- **Last pull request:** Documentation foundation in PR #1, merge commit
  `0108c44`.
- **Current branch:** `codex/ci-grants-fix` (off merged `main`). `main` contains
  milestone 2 (PR #2, `061f541`) and is deployed on Vercel;
  `codex/atomic-recipe-saves` is merged and can be deleted.
- **Remote:** `origin` points to
  `https://github.com/mitchthompson/meal-queue.git`.
- **Database status:** Existing Supabase data is treated as live. The repository
  has a canonical schema file (`supabase/schema.sql`) and a documented
  forward-only migration directory (`supabase/migrations/`). No database
  migration has been applied yet.
- **Latest application verification:** on 2026-06-27 (branch
  `codex/atomic-recipe-saves`): `npm run test` 13/13 pass; `npm run typecheck`
  clean (after excluding `mcp/` from the web-app tsconfig); `npm run build` green
  with placeholder `NEXT_PUBLIC_*` env. `npm run lint` is **non-functional** (no
  ESLint config — see [design-flags.md](design-flags.md)). The pgTAP DB tests
  have **not** run yet (no local Docker; they run in CI). See [qa.md](qa.md).
- **Latest documentation verification:** `git diff --check` passed on
  2026-06-11.

## Active Handoff

- **In progress:** `codex/ci-grants-fix` — the explicit Data API grants
  migration (`20260701220327_data_api_grants.sql`, owner-approved; no-op on
  prod), `schema.sql` mirror, regenerated baseline, and hardened `ci.yml`
  (CLI pinned 2.109.0, service excludes, NOTESTS guard). Proven locally:
  fresh-from-migrations DB + pgTAP → 33/33.
- **Next action:** (1) owner: finish `pg_dump` backup, apply
  `20260627222320_atomic_recipe_save.sql` in the SQL editor (fixes live
  recipe-saves), verify with a real save, and run `gh auth login`;
  (2) push `codex/ci-grants-fix` → PR → first green db-tests run;
  (3) rebuild the MCP server (`cd mcp && npm run build`) only after the prod
  migration is applied; (4) create `.env.local` for local acceptance testing;
  (5) resume milestones 3–4.
- **Blockers:** Prod recipe-saving errors until the `save_recipe` migration is
  applied (deploy-order slip: PR #2 merged before the DB migration; see
  [progress-log.md](progress-log.md) 2026-07-01).
- **Uncommitted work:** The `codex/ci-grants-fix` change set above (committing
  imminently this session).

## Page status

Per-page status of the working product. Routes confirmed against `app/`.
Per-page intent lives in `docs/pages/<slug>.md`.

| Page | Route | Status |
| --- | --- | --- |
| Dashboard | `/` (`app/page.tsx`) | Working; known issue — loads items for only the 4 newest plans (see open issues) |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; atomic `save_recipe` RPC switch is code-complete on `codex/atomic-recipe-saves` (milestone 2), pending CI + prod apply |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working |
| Plans | `/plans` (`app/plans/page.tsx`) | Working |
| Grocery | `/grocery` (`app/grocery/page.tsx`) | Working; regenerates silently on load (resets checklist state) |
| Settings | `/settings` (`app/settings/page.tsx`) | Working; `ensureUserSettings` runs twice per sign-in |

Authentication is email/password through Supabase. See [routes.md](routes.md)
and the per-page docs under `docs/pages/`. Working capabilities in brief:

- Recipe create, edit, delete, search, sort, tagging, structured steps, pantry
  flags, and serving previews.
- Meal plans with custom ranges, lunch and dinner slots, multiple recipes per
  slot, leftovers, eating-out notes, and serving multipliers.
- Grocery generation with exact-match ingredient grouping, pantry sections,
  on-hand state, and checkboxes.
- User defaults for plan length, week start, grocery order day, and pickup day.
- Responsive navigation and layouts for desktop and iPhone Safari.

## Milestone status

From [roadmap.md](roadmap.md). Reliability is the current priority.

| # | Milestone | Branch | Status |
| --- | --- | --- | --- |
| 0 | Documentation Foundation | — | Done (PR #1, `0108c44`) |
| 1 | Reliability Foundation | — | Done (`7cfbab2`, 2026-06-11) |
| 1.5 | CI + Test Harness | `codex/ci-grants-fix` | Nearly done — suite 33/33 locally; grants fix pending push/PR for first green CI (2026-07-01) |
| 2 | Atomic Recipe Saves | — | Merged (PR #2, `061f541`, 2026-07-01); prod DB migration being hand-applied (backup-first) |
| 3 | Plan Integrity | `codex/plan-integrity` | Planned |
| 4 | Grocery State Preservation | `codex/grocery-state-preservation` | Planned |
| 5 | UI Feedback and Ergonomics | `codex/ui-feedback-ergonomics` | Planned (after reliability core) |
| 6 | Component Hardening | `codex/component-hardening` | Planned |

Milestones 2–4 are implemented with Postgres functions (RPCs) and triggers
applied through the Supabase SQL editor, confirmed by the 2026-06-11 code audit.

## Architecture snapshot

- Next.js 15 App Router and React 19; hosted on Vercel.
- Client components query Supabase directly through the browser client
  (`lib/supabase/client.ts`).
- Supabase Postgres stores application data and enforces owner-based row-level
  security (every table has an owner policy keyed on `auth.uid()`).
- Plain CSS with a CSS-variable design-token system in `app/globals.css`
  (no Tailwind). See [design-system.md](design-system.md).
- Zod for validation; Vitest for the extracted domain logic in `lib/`.
- `supabase/schema.sql` is the canonical full schema; new forward-only changes
  belong in `supabase/migrations/`.

Full architecture, deploy, setup, migration, and rollback detail lives in
[architecture.md](architecture.md).

### Composition map

Most screen behavior currently lives in large client route components. Sizes are
indicative of where the logic concentrates (and why milestone 6 splits them).

| Component | Holds |
| --- | --- |
| `app/plans/page.tsx` (~1100 lines) | Plan CRUD, week grid, lunch/dinner slots, leftovers, eat-out notes, serving multipliers, client-side plan version bumps |
| `app/recipes/page.tsx` (~900 lines) | Recipe list, search/sort, tag management, recipe editor, the non-atomic save sequence (parent update + child delete/reinsert) |
| `app/page.tsx` — dashboard (~480 lines) | Current/upcoming plan and grocery summaries; loads only the 4 newest plans |
| `app/grocery/page.tsx` (~420 lines) | Grocery list rendering, checkbox/on-hand state, regenerate-on-load |
| `app/recipes/[id]/page.tsx` (~300 lines) | Read-only recipe detail with scaled serving preview |
| `app/settings/page.tsx` (~190 lines) | User defaults form (plan length, week start, order/pickup weekdays) |
| `lib/date-utils.ts` | Pure date calculations (Vitest-covered) |
| `lib/grocery.ts` | Grocery scaling, normalization, grouping, amount formatting (Vitest-covered) |

Vitest covers the extracted domain logic in `lib/`, not the Supabase write
flows or UI interactions.

## Schema / data model summary

Canonical schema: `supabase/schema.sql`. Human-readable derived model:
[data-model.md](data-model.md). Confirm exact columns and defaults against the
schema before building — do not trust restatements.

| Table | Purpose | Owner key |
| --- | --- | --- |
| `units` | Controlled unit codes for exact-match grocery combining (globally readable) | none (read-all) |
| `user_settings` | Per-user defaults: plan days, week start, order/pickup weekdays | `user_id` |
| `recipes` | Recipe parent (name, base servings, raw instructions) | `user_id` |
| `recipe_steps` | Ordered structured steps per recipe | via parent recipe |
| `ingredients` | Recipe ingredients (name, amount, unit, pantry-staple flag) | via parent recipe |
| `tags` | Per-user recipe tags (unique per user+name) | `user_id` |
| `recipe_tags` | Recipe↔tag join | via parent recipe |
| `meal_plans` | Plan with date range, order/pickup dates, `version` counter | `user_id` |
| `meal_plan_items` | Per-day slots: `meal_type` (lunch/dinner), `slot_type` (cook/leftover/eat_out), recipe link, leftover link, serving multiplier | via parent plan |
| `grocery_list_items` | Persisted generated grocery rows with checked/on-hand state and `source_key` | via parent plan |

All application tables enable row-level security with a single owner policy.
Notable constraints already in the schema: `meal_plans.end_date >= start_date`;
`meal_plan_items` slot/recipe consistency (eat-out has no recipe; cook/leftover
require one) and leftover-link consistency. See [data-model.md](data-model.md)
for the complete relationship map.

## Open issues

Confirmed-in-code issues deliberately outside the current reliability scope are
tracked in the roadmap's "Deferred Fixes" sections
([roadmap.md](roadmap.md)) with detail in
[CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md) and
[UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md). Unresolved design and
unconfirmed-value questions are tracked in [design-flags.md](design-flags.md).
Highest-signal items:

- **Non-atomic recipe save** (`app/recipes/page.tsx`): parent update, child
  delete, child insert run as separate client requests; a failure can leave a
  partially updated recipe. (Milestone 2 fix — the `save_recipe` RPC — is
  code-complete on `codex/atomic-recipe-saves`, pending CI proof and the prod
  hand-apply.)
- **Tooling flags raised 2026-06-27** (detail in [design-flags.md](design-flags.md)):
  `npm run lint` is non-functional (no ESLint config; `next lint` opens an
  interactive wizard); `npm ci` reports 1 high-severity vulnerability (docs
  previously said zero); `mcp/` has 9 npm-audit findings of its own. Resolved
  2026-07-01: prod confirmed Postgres 17.6, `config.toml` aligned to 17.
- **Stale groceries after ingredient edits:** editing recipe ingredients does
  not invalidate grocery lists for plans using that recipe. (Milestone 2.)
- **Grocery regeneration loses state:** delete-and-recreate resets checked,
  on-hand, and manual pantry overrides; the grocery page also regenerates
  silently on load. (Milestone 4.)
- **Plan version races:** version bumps use separate client read/update
  requests that can lose concurrent increments, and fire even for changes that
  do not affect groceries. (Milestone 3.)
- **Weak DB constraints:** dates, same-owner references, and leftover
  relationships are not yet fully enforced at the database level. (Milestone 3.)
- **Dashboard window** (`app/page.tsx`): loads items for only the 4 newest
  plans by start date, so the current week can render empty when several future
  plans exist.
- **Settings duplication:** `ensureUserSettings` runs twice per sign-in, and
  default settings values are duplicated across three files inconsistently with
  the SQL defaults.
- **Test gaps:** automated coverage protects date and grocery calculations, but
  not Supabase write flows or UI interactions.

## Repository notes

- `main` tracks `origin/main`. Use focused `codex/...` branches for
  implementation work.
- Pull requests are required for database migrations, broad refactors, and
  other high-risk changes. Low-risk and documentation-only work may be committed
  directly to `main` after review and verification. Pushing to `main` deploys to
  Vercel — see [architecture.md](architecture.md) and [design-flags.md](design-flags.md)
  for the (unconfirmed) deploy trigger.
- `.env.local`, `.codex/`, `.mcp.json`, and `recipe-export.json` are
  local-only. The `mcp/` recipe-import server source is tracked in Git as of
  2026-06-11; its build output and `node_modules` are not.
- GitHub CLI and Supabase CLI are not currently installed. Pull requests are
  opened in GitHub's web interface, and migrations are applied through the
  Supabase SQL editor.
- Next.js is patched to `15.5.19`; targeted transitive overrides keep
  `npm audit` at zero known vulnerabilities.

## Where to go next

- Verification commands and per-change QA — [qa.md](qa.md)
- Milestones and deferred work — [roadmap.md](roadmap.md)
- Architecture, deploy, migration, rollback — [architecture.md](architecture.md)
- Data model — [data-model.md](data-model.md) (canonical: `supabase/schema.sql`)
- Routes — [routes.md](routes.md); per-page intent — `docs/pages/`
- Design tokens — [design-system.md](design-system.md);
  open design questions — [design-flags.md](design-flags.md)
- Decisions and history — [decisions.md](decisions.md),
  [progress-log.md](progress-log.md)
- Doc index — [README.md](README.md)
