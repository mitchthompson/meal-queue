# Data Model

Human-readable reference for the Meal Queue database. This document is **derived** from the
schema; it is not authoritative.

**Canonical source of truth:** [`supabase/schema.sql`](../supabase/schema.sql). That file is the
only authoritative description of the database. This page is a convenience summary that can drift.
Always confirm columns, types, defaults, constraints, and policies against `supabase/schema.sql`
before relying on them. **Never guess a column, default, or data value** — if something here is
unconfirmed or stale, treat it as TBD and reconcile against the schema, or raise it in
[`design-flags.md`](design-flags.md).

> Scope: single-household app. Every table is in the `public` schema and protected by Row-Level
> Security (RLS). The schema file is written idempotently (`create table if not exists`,
> `add column if not exists`, `drop ... if exists` before `create`) so it can be re-applied. All
> values below reflect the **final effective state** after the in-file `ALTER` statements, not just
> the original `CREATE TABLE` bodies.

## Overview

| Table | Purpose | Owner scoping |
| --- | --- | --- |
| `units` | Controlled vocabulary of measurement unit codes (seeded, global). | Globally readable (not user-scoped). |
| `user_settings` | Per-user planning preferences/defaults. One row per auth user. | Direct (`user_id`). |
| `recipes` | User-owned recipes. | Direct (`user_id`). |
| `recipe_steps` | Ordered instruction steps for a recipe. | Inherited via `recipes`. |
| `ingredients` | Ingredients (amount + unit) for a recipe. | Inherited via `recipes`. |
| `tags` | User-owned tag labels. | Direct (`user_id`). |
| `recipe_tags` | Many-to-many join of recipes and tags. | Inherited via `recipes`. |
| `meal_plans` | A meal plan over a date range, with order/pickup dates and a version counter. | Direct (`user_id`). |
| `meal_plan_items` | Entries in a plan (date + meal type + slot type). | Inherited via `meal_plans`. |
| `grocery_list_items` | Materialized, pre-combined grocery rows with checklist state. | Inherited via `meal_plans`. |

## Enumerations

No native Postgres `ENUM` types or `DOMAIN`s are declared. All enumerations are enforced via
`CHECK` constraints:

| Where | Allowed values |
| --- | --- |
| `units.unit_type` | `volume` &#124; `weight` &#124; `count` &#124; `other` |
| `meal_plan_items.meal_type` | `lunch` &#124; `dinner` |
| `meal_plan_items.slot_type` | `cook` &#124; `leftover` &#124; `eat_out` |

## Functions and triggers

- **Extension:** `pgcrypto` (`create extension if not exists pgcrypto`) — provides
  `gen_random_uuid()`, the default for all `uuid` primary keys.
- **`public.set_updated_at()`** `returns trigger language plpgsql` — sets
  `new.updated_at = now()` and returns `new`. Used as a `BEFORE UPDATE FOR EACH ROW` trigger.
- **Triggers** (each dropped if it exists, then recreated; `BEFORE UPDATE ... FOR EACH ROW EXECUTE
  FUNCTION public.set_updated_at()`):
  - `set_updated_at_user_settings` on `public.user_settings`
  - `set_updated_at_recipes` on `public.recipes`
  - `set_updated_at_meal_plans` on `public.meal_plans`

Only `user_settings`, `recipes`, and `meal_plans` carry an `updated_at` column and trigger. The
other tables do not.

## Indexes

Beyond primary-key and unique indexes, the schema defines:

| Index | On |
| --- | --- |
| `meal_plans_user_id_idx` | `meal_plans(user_id)` |
| `recipes_user_id_idx` | `recipes(user_id)` |
| `tags_user_id_idx` | `tags(user_id)` |
| `meal_plan_items_meal_plan_id_idx` | `meal_plan_items(meal_plan_id)` |
| `meal_plan_items_slot_type_idx` | `meal_plan_items(slot_type)` |
| `meal_plan_items_leftover_from_item_id_idx` | `meal_plan_items(leftover_from_item_id)` |
| `grocery_list_items_meal_plan_id_idx` | `grocery_list_items(meal_plan_id)` |

---

## `public.units`

Controlled vocabulary of measurement unit codes used for V1 exact-match ingredient combining on
grocery lists. Globally readable (not user-scoped). Seeded with 13 rows via
`insert ... on conflict (code) do nothing`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `code` | `text` | no | — | Primary key. Unit code, e.g. `tsp`, `cup`, `g`. |
| `label` | `text` | no | — | Human-readable label, e.g. `teaspoon`. |
| `unit_type` | `text` | no | — | `CHECK (unit_type in ('volume','weight','count','other'))`. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `code`
- **Foreign keys:** none
- **Constraints:** `PRIMARY KEY (code)`; `CHECK (unit_type in ('volume','weight','count','other'))`
- **RLS:** enabled. Policy `units_read_all` — `FOR SELECT USING (true)` (globally readable). No
  insert/update/delete policy, so writes are blocked under RLS for non-privileged roles.
- **Seed data:** `tsp`, `tbsp`, `cup`, `fl_oz`, `ml`, `l` (volume); `oz`, `lb`, `g`, `kg` (weight);
  `item`, `clove`, `slice` (count). `other` is a valid `unit_type` but no seeded row uses it.

## `public.user_settings`

Per-user planning preferences/defaults (plan length, week start day, default order/pickup
weekdays). One row per auth user (`user_id` is the PK).

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `user_id` | `uuid` | no | — | Primary key. FK -> `auth.users(id)` `ON DELETE CASCADE`. |
| `default_plan_days` | `integer` | no | `7` | `CHECK (default_plan_days between 1 and 21)`. |
| `week_starts_on` | `integer` | no | `5` | `CHECK (week_starts_on between 0 and 6)`. 0=Sunday .. 6=Saturday. |
| `default_order_weekday` | `integer` | yes | — | `CHECK (default_order_weekday between 0 and 6)`. Nullable. |
| `default_pickup_weekday` | `integer` | yes | — | `CHECK (default_pickup_weekday between 0 and 6)`. Nullable. |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Maintained by trigger `set_updated_at_user_settings`. |

- **Primary key:** `user_id`
- **Foreign keys:** `user_id -> auth.users(id) ON DELETE CASCADE`
- **Constraints:** `PRIMARY KEY (user_id)`; the four `CHECK` ranges listed above.
- **RLS:** enabled. Policy `user_settings_owner` —
  `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.

> Note: the SQL defaults leave `default_order_weekday` / `default_pickup_weekday` **null**. Client
> code has historically used different defaults — see the open flag in
> [`design-flags.md`](design-flags.md) about default settings disagreeing across files.

## `public.recipes`

User-owned recipes. Parent of `recipe_steps`, `ingredients`, and `recipe_tags`; referenced by
`meal_plan_items`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | no | — | FK -> `auth.users(id)` `ON DELETE CASCADE`. |
| `name` | `text` | no | — | |
| `base_servings` | `numeric(6,2)` | no | `2` | |
| `instructions_raw` | `text` | yes | — | Optional raw/unstructured instructions text. |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Maintained by trigger `set_updated_at_recipes`. |

- **Primary key:** `id`
- **Foreign keys:** `user_id -> auth.users(id) ON DELETE CASCADE`
- **Constraints:** `PRIMARY KEY (id)`
- **RLS:** enabled. Policy `recipes_owner` —
  `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.

## `public.recipe_steps`

Ordered instruction steps belonging to a recipe.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `recipe_id` | `uuid` | no | — | FK -> `public.recipes(id)` `ON DELETE CASCADE`. |
| `step_number` | `integer` | no | — | `CHECK (step_number > 0)`. Unique per recipe. |
| `body` | `text` | no | — | Step instruction text. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `id`
- **Foreign keys:** `recipe_id -> public.recipes(id) ON DELETE CASCADE`
- **Constraints:** `PRIMARY KEY (id)`; `CHECK (step_number > 0)`; `UNIQUE (recipe_id, step_number)`
- **RLS:** enabled. Policy `recipe_steps_owner` — `FOR ALL` with `USING` / `WITH CHECK`
  `EXISTS (select 1 from public.recipes r where r.id = recipe_steps.recipe_id and r.user_id = auth.uid())`.
  Ownership is inherited via the parent recipe.

## `public.ingredients`

Ingredients belonging to a recipe, with amount + unit; a flag for pantry staples (affects
grocery-list inclusion).

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `recipe_id` | `uuid` | no | — | FK -> `public.recipes(id)` `ON DELETE CASCADE`. |
| `name` | `text` | no | — | |
| `amount` | `numeric(10,3)` | no | — | `CHECK (amount >= 0)`. |
| `unit_code` | `text` | no | — | FK -> `public.units(code)`. No `ON DELETE` action (defaults to `NO ACTION`). |
| `is_pantry_staple` | `boolean` | no | `false` | |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `id`
- **Foreign keys:** `recipe_id -> public.recipes(id) ON DELETE CASCADE`; `unit_code -> public.units(code)`
- **Constraints:** `PRIMARY KEY (id)`; `CHECK (amount >= 0)`
- **RLS:** enabled. Policy `ingredients_owner` — `FOR ALL` with `USING` / `WITH CHECK`
  `EXISTS (select 1 from public.recipes r where r.id = ingredients.recipe_id and r.user_id = auth.uid())`.
  Ownership is inherited via the parent recipe.

## `public.tags`

User-owned tag labels for categorizing recipes. Joined to recipes via `recipe_tags`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | no | — | FK -> `auth.users(id)` `ON DELETE CASCADE`. |
| `name` | `text` | no | — | Unique per user. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `id`
- **Foreign keys:** `user_id -> auth.users(id) ON DELETE CASCADE`
- **Constraints:** `PRIMARY KEY (id)`; `UNIQUE (user_id, name)`
- **RLS:** enabled. Policy `tags_owner` —
  `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.

## `public.recipe_tags`

Many-to-many join between recipes and tags. Composite primary key `(recipe_id, tag_id)`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `recipe_id` | `uuid` | no | — | FK -> `public.recipes(id)` `ON DELETE CASCADE`. Part of composite PK. |
| `tag_id` | `uuid` | no | — | FK -> `public.tags(id)` `ON DELETE CASCADE`. Part of composite PK. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `(recipe_id, tag_id)`
- **Foreign keys:** `recipe_id -> public.recipes(id) ON DELETE CASCADE`;
  `tag_id -> public.tags(id) ON DELETE CASCADE`
- **Constraints:** `PRIMARY KEY (recipe_id, tag_id)`
- **RLS:** enabled. Policy `recipe_tags_owner` — `FOR ALL` with `USING` / `WITH CHECK`
  `EXISTS (select 1 from public.recipes r where r.id = recipe_tags.recipe_id and r.user_id = auth.uid())`.
  Ownership is inherited via the parent recipe; the tag side is not separately checked.

## `public.meal_plans`

A user's meal plan spanning a date range, with optional grocery order/pickup dates and a version
counter. Parent of `meal_plan_items` and `grocery_list_items`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | no | — | FK -> `auth.users(id)` `ON DELETE CASCADE`. |
| `start_date` | `date` | no | — | |
| `end_date` | `date` | no | — | Table-level `CHECK (end_date >= start_date)`. |
| `order_date` | `date` | yes | — | Optional grocery order date. |
| `pickup_date` | `date` | yes | — | Optional grocery pickup date. |
| `version` | `integer` | no | `1` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Maintained by trigger `set_updated_at_meal_plans`. |

- **Primary key:** `id`
- **Foreign keys:** `user_id -> auth.users(id) ON DELETE CASCADE`
- **Constraints:** `PRIMARY KEY (id)`; `CHECK (end_date >= start_date)`
- **RLS:** enabled. Policy `meal_plans_owner` —
  `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.

## `public.meal_plan_items`

An entry in a meal plan: a specific date + meal type (lunch/dinner) + slot type
(cook/leftover/eat_out), optionally referencing a recipe, optionally linking to the source item it
is a leftover of, with a serving multiplier and free-text note. Self-referencing via
`leftover_from_item_id`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `meal_plan_id` | `uuid` | no | — | FK -> `public.meal_plans(id)` `ON DELETE CASCADE`. |
| `plan_date` | `date` | no | — | |
| `meal_type` | `text` | no | — | `CHECK (meal_type in ('lunch','dinner'))`. |
| `slot_type` | `text` | no | `'cook'` | `CHECK (slot_type in ('cook','leftover','eat_out'))`. |
| `recipe_id` | `uuid` | yes | — | FK -> `public.recipes(id)` `ON DELETE CASCADE`. Originally `NOT NULL`, altered to drop it. Required/forbidden by slot (see slot/recipe check). |
| `leftover_from_item_id` | `uuid` | yes | — | Self FK -> `public.meal_plan_items(id)` `ON DELETE SET NULL`. Constrained by leftover-link check. |
| `note` | `text` | yes | — | Free-text note. |
| `serving_multiplier` | `numeric(8,3)` | no | `1` | `CHECK (serving_multiplier > 0)`. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `meal_plan_id -> public.meal_plans(id) ON DELETE CASCADE`
  - `recipe_id -> public.recipes(id) ON DELETE CASCADE`
  - `leftover_from_item_id -> public.meal_plan_items(id) ON DELETE SET NULL` (self-reference)
- **Constraints:**
  - `PRIMARY KEY (id)`
  - `CHECK (meal_type in ('lunch','dinner'))`
  - `CHECK (slot_type in ('cook','leftover','eat_out'))`
  - `CHECK (serving_multiplier > 0)`
  - `meal_plan_items_slot_recipe_check` —
    `CHECK ((slot_type = 'eat_out' and recipe_id is null) or (slot_type in ('cook','leftover') and recipe_id is not null))`
  - `meal_plan_items_leftover_link_check` —
    `CHECK ((slot_type = 'leftover') or (slot_type <> 'leftover' and leftover_from_item_id is null))`
- **RLS:** enabled. Policy `meal_plan_items_owner` — `FOR ALL` with `USING` / `WITH CHECK`
  `EXISTS (select 1 from public.meal_plans mp where mp.id = meal_plan_items.meal_plan_id and mp.user_id = auth.uid())`.
  Ownership is inherited via the parent meal plan.

> Migration note: the prior unique index `meal_plan_items_unique_slot_idx` is dropped to allow
> multiple recipes per slot (e.g. a dinner main plus sides). There is **no** uniqueness constraint
> on `(meal_plan_id, plan_date, meal_type)`. `recipe_id` is nullable in the live schema, governed by
> `meal_plan_items_slot_recipe_check` (required for `cook`/`leftover`, must be null for `eat_out`).

## `public.grocery_list_items`

Persisted, materialized grocery-list rows for a meal plan. Keeps checklist state (on-hand /
checked) stable until the list is regenerated. Amounts are pre-combined; `source_key` identifies
the aggregation key.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | Primary key. |
| `meal_plan_id` | `uuid` | no | — | FK -> `public.meal_plans(id)` `ON DELETE CASCADE`. |
| `ingredient_name` | `text` | no | — | |
| `amount` | `numeric(12,3)` | no | — | Combined amount. No `CHECK` on this column (unlike `ingredients.amount`). |
| `unit_code` | `text` | no | — | FK -> `public.units(code)`. No `ON DELETE` action (`NO ACTION`). |
| `is_pantry_staple` | `boolean` | no | `false` | |
| `is_on_hand` | `boolean` | no | `false` | |
| `is_checked` | `boolean` | no | `false` | |
| `source_key` | `text` | no | — | Aggregation/dedup key identifying how the row was combined. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key:** `id`
- **Foreign keys:** `meal_plan_id -> public.meal_plans(id) ON DELETE CASCADE`;
  `unit_code -> public.units(code)`
- **Constraints:** `PRIMARY KEY (id)`
- **RLS:** enabled. Policy `grocery_list_items_owner` — `FOR ALL` with `USING` / `WITH CHECK`
  `EXISTS (select 1 from public.meal_plans mp where mp.id = grocery_list_items.meal_plan_id and mp.user_id = auth.uid())`.
  Ownership is inherited via the parent meal plan.

---

## Related docs

- [`supabase/schema.sql`](../supabase/schema.sql) — canonical schema (authoritative).
- [`architecture.md`](architecture.md) — how the app reads/writes this data.
- [`current-state.md`](current-state.md) — present behavior, status, and known risks.
- [`design-flags.md`](design-flags.md) — open questions and unconfirmed values.
