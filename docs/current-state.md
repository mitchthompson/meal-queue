# Current State

Last reviewed: 2026-06-19

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

> Doc-system note: this session migrated the documentation set from the old
> UPPERCASE filenames to the lowercase-kebab system. All internal links below
> point at the new names (e.g. [data-model.md](data-model.md),
> [roadmap.md](roadmap.md)). The dated audit artifacts
> ([CODE_AUDIT_2026-06-11.md](CODE_AUDIT_2026-06-11.md),
> [UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md)) keep their original names.

## Current build phase

**Reliability core.** The reliability foundation (milestone 1) is merged.
**Next up: milestone 2 — atomic recipe saves** on `codex/atomic-recipe-saves`.
Existing household data is live and must stay compatible throughout this work.
See [roadmap.md](roadmap.md) for the full milestone plan.

## Stable Baseline

- **Last completed work:** Front-end UI audit documented and roadmap
  milestone 5 added as `117a660`, following the reliability foundation and
  code audit merges (`7cfbab2`, `e13f158`). GitHub CLI is not installed, so the
  owner approved merging the reviewed branches locally instead of through web
  pull requests.
- **Last pull request:** Documentation foundation in PR #1, merge commit
  `0108c44`.
- **Current branch:** `main`, tracking `origin/main`.
- **Remote:** `origin` points to
  `https://github.com/mitchthompson/meal-queue.git`.
- **Database status:** Existing Supabase data is treated as live. The repository
  has a canonical schema file (`supabase/schema.sql`) and a documented
  forward-only migration directory (`supabase/migrations/`). No database
  migration has been applied yet.
- **Latest application verification:** `npm run test` (13 passing),
  `npm run typecheck`, and `npm run build` passed on 2026-06-11 on merged
  `main`. See [qa.md](qa.md) for the verification procedure.
- **Latest documentation verification:** `git diff --check` passed on
  2026-06-11.

## Active Handoff

- **In progress:** Nothing. The front-end UI audit is complete
  ([UI_AUDIT_2026-06-11.md](UI_AUDIT_2026-06-11.md)) and its agreed scope is
  recorded as roadmap milestone 5, after the reliability core and before
  component hardening.
- **Next action:** Start milestone 2 (atomic recipe saves) on
  `codex/atomic-recipe-saves`.
- **Blockers:** None.
- **Uncommitted work:** None.

## Page status

Per-page status of the working product. Routes confirmed against `app/`.
Per-page intent lives in `docs/pages/<slug>.md`.

| Page | Route | Status |
| --- | --- | --- |
| Dashboard | `/` (`app/page.tsx`) | Working; known issue — loads items for only the 4 newest plans (see open issues) |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; non-atomic save is the milestone 2 target |
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
| 2 | Atomic Recipe Saves | `codex/atomic-recipe-saves` | Next |
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
  partially updated recipe. (Milestone 2 fixes this.)
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
