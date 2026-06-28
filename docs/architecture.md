# Architecture

How Meal Queue is structured, how data flows through it, the invariants it must
preserve, and how it is set up, migrated, and deployed.

For the human-readable data model see [data model](data-model.md); for the
canonical schema read [`supabase/schema.sql`](../supabase/schema.sql) directly.
For verification, acceptance, and end-of-session wrap, see [qa](qa.md).

## System Overview

Meal Queue is a Next.js App Router application deployed as a browser-based
client. Authenticated client components use `@supabase/supabase-js` to query
Supabase Postgres directly. Row-level security limits every user-owned table to
the authenticated owner.

## Application Areas

- `components/auth-gate.tsx` owns client session initialization and the
  email/password gate.
- `components/app-shell.tsx` owns desktop and mobile navigation.
- `app/recipes` owns recipe library, editing, serving previews, and cooking
  steps.
- `app/plans` owns date-range plans and meal-slot scheduling.
- `app/grocery` owns grocery generation and checklist state.
- `app/settings` owns household planning defaults.
- `lib/date-utils.ts` owns pure local-calendar date arithmetic and plan-date
  defaults.
- `lib/grocery.ts` owns pure ingredient scaling, normalization, grouping, and
  grocery-row construction.
- `lib/supabase/client.ts` creates the browser Supabase client.

## Data Model

- `user_settings`: Per-user defaults.
- `recipes`: Recipe identity, servings, and raw imported instructions.
- `ingredients`: Recipe quantities, controlled units, and pantry flags.
- `recipe_steps`: Ordered canonical instructions.
- `tags` and `recipe_tags`: User-owned recipe categorization.
- `meal_plans`: Explicit date ranges, order/pickup dates, and a generation
  version.
- `meal_plan_items`: Cooked recipes, leftovers, or eating-out entries for a date
  and meal type.
- `grocery_list_items`: Materialized grocery quantities and per-plan user
  checklist state.

The canonical schema is [`supabase/schema.sql`](../supabase/schema.sql); the
derived, human-readable version is [data model](data-model.md).

## Current Data Flows

### Recipe Save

The client saves the recipe parent, deletes existing ingredients, steps, and tag
links, then inserts replacements. These requests are not transactional and are
scheduled for replacement by a database function.

### Plan Mutation

The client inserts, updates, or removes a meal-plan item, then separately reads
and increments `meal_plans.version`. Grocery lists use that version to detect
staleness.

### Grocery Generation

The client loads cooked plan items and recipe ingredients, scales quantities,
then passes them to the tested `buildGroceryRows` domain function. The client
still deletes all existing grocery rows and inserts the new set, which resets
checklist state.

## Invariants

- All user-owned rows must remain inaccessible to other users.
- A plan's `end_date` must not precede its `start_date`.
- Cook and leftover items require a recipe; eating-out items do not.
- Recipe steps are ordered uniquely within a recipe.
- Grocery amounts combine only for the same normalized name, unit, and pantry
  classification.
- Future migrations must preserve existing live data.

## MCP Boundary

The recipe-import MCP server under [`mcp/`](../mcp/) is a separate package with
its own lifecycle and is out of scope for the web app. The Next.js client does
not import from it, and changes here do not implicate it unless a task names it
explicitly.

## Known Structural Debt

- Core route files contain UI, state management, queries, and domain logic.
- Display-date formatting remains duplicated across route components.
- Aggregate writes are composed in the browser instead of database
  transactions.
- Generated Supabase database types are not present.

## Test Boundaries

Vitest currently covers:

- Local calendar formatting and date arithmetic.
- Plan default and next-start calculations.
- Ingredient scaling and three-decimal rounding.
- Grocery normalization, exact-match grouping, pantry separation, and source
  keys.

Database transactions, row-level security, and UI interactions do not yet have
automated coverage in the committed baseline. Milestone 1.5 (on
`codex/atomic-recipe-saves`, 2026-06-27) adds a CI pgTAP suite that exercises the
`save_recipe` function — atomicity rollback, RLS/owner-scope, and version-bump
invalidation — against an ephemeral local Supabase stack on GitHub Actions
(no cloud credentials). Broader UI-interaction coverage remains open.

## Deploy & Operations

### Setup & Environment

Requirements:

- Node.js and npm.
- A Supabase project.
- `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read by `lib/supabase/client.ts`).

Install and run locally:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. For the full verification command set, see
[qa](qa.md).

Do not commit `.env.local`, `.codex/`, `recipe-export.json`, Supabase temporary
files, or generated build output.

### Applying Database Migrations

Existing Supabase records are live data. There is no Supabase CLI installed; all
schema changes are applied by hand through the Supabase SQL editor.

For each schema change:

1. Add an ordered SQL file under `supabase/migrations/` using
   `YYYYMMDDHHMMSS_description.sql`.
2. Include read-only preflight queries for incompatible existing rows.
3. Prefer additive schema changes and backfills.
4. Document rollback or forward-recovery steps.
5. Keep [`supabase/schema.sql`](../supabase/schema.sql) synchronized as the
   canonical full schema.
6. Review the pull request before applying SQL (migrations always require a PR).
7. Run preflight queries in the Supabase SQL editor.
8. Apply the migration through the SQL editor.
9. Verify data and application behavior before deploying dependent client code.

Stop if preflight checks return incompatible data. Do not reset the database or
discard user records to make a migration pass. See
[`supabase/migrations/README.md`](../supabase/migrations/README.md) for the
migration-file contract and baseline policy.

### Vercel Deploy

Production runs on Vercel.

> **Flagged assumption (unconfirmed):** push to `main` auto-deploys to Vercel.
> The exact deploy trigger/branch and whether a manual promote step exists are
> not yet confirmed — see [design flags](design-flags.md). Treat any push to
> `main` as a release action requiring approval.

Deploy order:

- Apply backward-compatible database migrations before deploying the dependent
  application code.
- Verify the current production workflow after migration and again after
  deployment (see [qa](qa.md)).

### Rollback

- For client-only regressions, redeploy the prior known-good commit.
- For database regressions, follow the migration's documented recovery steps; do
  not assume a destructive down migration is safe.

### Tooling Status

- Git remote: `https://github.com/mitchthompson/meal-queue.git`.
- GitHub CLI is not installed; pull requests use GitHub's web interface.
- Supabase CLI: used for **local/CI testing only** (an ephemeral local stack +
  pgTAP, as of milestone 1.5, 2026-06-27). Prod database changes are still
  hand-applied through the Supabase SQL editor; `supabase db push` is not run
  against the live project.

## Related Docs

- [product](product.md) — what Meal Queue is and who it serves.
- [data model](data-model.md) — human-readable schema.
- [qa](qa.md) — verification, acceptance, and session-wrap procedures.
- [decisions](decisions.md) — durable design decisions.
- [current state](current-state.md) — baseline, active work, and status.
- [design flags](design-flags.md) — unconfirmed assumptions and missing values.
