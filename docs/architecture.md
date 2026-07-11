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
- `app/plans` owns date-range plans and per-day meal scheduling (flat day
  lists since 2026-07-02).
- `app/grocery` owns grocery generation and checklist state.
- `app/settings` owns household planning defaults.
- `lib/date-utils.ts` owns pure local-calendar date arithmetic and plan-date
  defaults.
- `lib/grocery.ts` owns pure ingredient scaling, normalization, grouping, and
  grocery-row construction.
- `lib/supabase/client.ts` creates the browser Supabase client.
- `app/api/import-recipe` owns the recipe-import server route (parse-only; the
  app's first server-side code, milestone 8).
- `lib/import/` owns the import pipeline consumed only by that route: request and
  draft schemas, the LLM prompt, HTML/JSON-LD extraction, draft normalization,
  URL-safety plus page fetch, token auth, and the Anthropic call.

## Data Model

- `user_settings`: Per-user defaults.
- `recipes`: Recipe identity, servings, and raw imported instructions.
- `ingredients`: Recipe quantities, controlled units, and pantry flags.
- `recipe_steps`: Ordered canonical instructions.
- `tags` and `recipe_tags`: User-owned recipe categorization.
- `meal_plans`: Explicit date ranges, order/pickup dates, and a generation
  version.
- `meal_plan_items`: Cooked recipes, leftovers, or eating-out entries for a
  plan date (`meal_type` is vestigial — days are flat meal lists, 2026-07-02).
- `grocery_list_items`: Materialized grocery quantities and per-plan user
  checklist state.

The canonical schema is [`supabase/schema.sql`](../supabase/schema.sql); the
derived, human-readable version is [data model](data-model.md).

## Current Data Flows

### Recipe Save

The client calls the atomic `save_recipe` Postgres function (security invoker,
so RLS still applies): parent update plus ingredient/step/tag-link replacement
in one transaction — any invalid child row rolls back the whole save
(milestone 2, 2026-07-01). The version bump for referencing plans is
diff-based, firing only when the recipe's ingredient identity set actually
changes. The MCP `save-recipe` tool uses the same function (service-role path).

### Plan Mutation

The client inserts, updates, or removes a meal-plan item;
`meal_plans.version` increments via database triggers scoped to
grocery-relevant changes (cook items added/removed; recipe or serving
multiplier changed), with BEFORE-trigger cross-row validations under row locks.
The client performs no version reads or writes (milestone 3, 2026-07-02).
Item-level mutations apply optimistically in the UI with targeted per-item
rollback (milestone 10 PR 2, 2026-07-05).

### Grocery Generation

The client calls the transactional `regenerate_grocery_list(p_plan_id)`
function, which rebuilds the list server-side as an upsert by stable identity
(normalized name | unit | pantry classification) — checked / on-hand /
pantry-override state survives for unchanged items, and obsolete rows are
removed only after the replacement upsert succeeds (milestone 4, 2026-07-02).
Staleness is plan-level (`meal_plans.groceries_version` vs `version`) and is
surfaced as a banner with an explicit Generate/Update button — nothing
regenerates on page load (milestone 10 PR 1, 2026-07-05). The pure
scaling/normalization logic in `lib/grocery.ts` remains vitest-covered.

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

## Server Surface and Anthropic Boundary

The app was 100% client components until in-app Recipe Import (milestone 8).
`POST /api/import-recipe` (`app/api/import-recipe/route.ts`, Node runtime) is the
first server-side code and the first paid external dependency (the Anthropic API,
Claude Haiku 4.5). It exists because pasted recipe text needs LLM parsing and the
API key must stay server-only.

The route is deliberately narrow:

- It **parses only and never touches the database.** It verifies the caller's
  Supabase token as an auth gate (`supabase.auth.getUser`) and returns a draft;
  saving stays client-side through the `save_recipe` RPC (the auth.uid RLS path),
  unchanged.
- It reads `ANTHROPIC_API_KEY` at request time, never at module load, so
  `next build` stays green without the key. No new Supabase env (the
  `NEXT_PUBLIC_*` vars are readable server-side).
- The extraction, schema, and pantry logic in `lib/import/` is **copied, not
  imported, from `mcp/`** (ported files carry a provenance header). `mcp/` stays
  a separate package; the two are not merged.

Cost posture and guardrails: ~$0.006–0.01 per import on Haiku 4.5 ($1/$5 per
MTok), bounded by input caps (25k-char paste, 15k JSON-LD, 8k text fallback) and
`max_tokens: 4096`. The perimeter is the auth gate plus an Anthropic Console
monthly spend cap; there is no rate limiter (single household, no KV in the
stack). See [decisions](decisions.md) and
[plans/recipe-import.md](plans/recipe-import.md).

## Known Structural Debt

- Route files own UI and per-screen state; data access is extracted to
  per-page hooks in `lib/hooks/` (milestone 6, 2026-07-02), but hook/UI
  interaction behavior has no automated coverage (open design flag).
- Generated Supabase database types are not present.

## Test Boundaries

Vitest (138 tests across 9 files as of 2026-07-11) covers the `lib/` domain
logic:

- Local calendar formatting, date arithmetic, and plan defaults.
- Ingredient scaling, rounding, grocery normalization/grouping, and source
  keys.
- Error mapping (`lib/errors.ts`).
- The import pipeline (`lib/import/*` schemas, prompt, extraction,
  normalization, fetch guards) and the `draftToFormState` mapper.

The database layer is covered by pgTAP in CI (milestone 1.5, first green
2026-07-01): 108 assertions across three suites — `save_recipe`
atomicity/RLS/version-bump, plan-integrity triggers, and grocery state
preservation — against an ephemeral local Supabase stack on GitHub Actions (no
cloud credentials).

UI-interaction coverage remains open (an open design flag). Per-change
Playwright harnesses live in `scripts/review-board/` and run locally at
verification time, not in CI.

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

Existing Supabase records are live data. The Supabase CLI is used for local/CI
testing only (see Tooling Status below); all prod schema changes are applied by
hand through the Supabase SQL editor.

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

Merging or pushing to `main` auto-deploys production, and branch pushes create
preview deployments; there is no manual promote step (confirmed by observation
2026-07-01 — see the resolved "Vercel deploy trigger" entry in
[design flags](design-flags.md)). Treat any push to `main` as a release action
requiring approval.

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
- GitHub CLI (`gh`) is installed and holds two accounts; act as the repo owner
  per command — `GH_TOKEN=$(gh auth token --user mitchthompson) gh ...` (the
  machine-wide active account `2a-webteam` gets a 403 on push to this repo).
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
