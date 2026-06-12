# Architecture

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
automated coverage.
