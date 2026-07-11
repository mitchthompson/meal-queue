-- 20260711225000_grocery_unit_merge.sql
-- Milestone 12 — Grocery unit merge (dimension-aware grouping)
--
-- Grocery grouping identity was lower(name)|unit_code|pantryflag, so
-- "1 cup chicken stock" and "240 ml chicken stock" rendered as two list
-- lines. This migration makes regenerate_grocery_list() merge within a
-- measurement dimension using the existing units.unit_type column:
--   - volume merges with volume, weight with weight (identity segment
--     becomes 'vol' / 'wt' instead of the unit code);
--   - count units (item, clove, slice) NEVER merge across codes — their
--     identity keeps the unit code;
--   - amounts are summed in a base unit (ml for volume, g for weight) via a
--     new units.base_factor column, and displayed in the LARGEST unit (by
--     base factor) actually contributing to the bucket in this regeneration
--     ("1 cup + 8 tbsp" -> "1.5 cup"), rounded to 3 decimals;
--   - pantry classification still separates buckets (unchanged).
-- The conversion data is data-driven (base_factor), no factors are hardcoded
-- in the function body. lib/grocery.ts (a documented client-side vestige no
-- app code calls for generation) is deliberately untouched; the aggregation
-- truth lives here.
--
-- STATE PRESERVATION across the identity change: surviving rows are migrated
-- from the old key (name|unit_code|flag) to the new key (name|vol/wt/code|flag)
-- in place. When two old rows collapse into one new bucket, the surviving row
-- (smallest id) takes bool_and of the parts' state — checked only if EVERY
-- merged part was checked, on-hand only if every part was on hand — the
-- conservative "still need to buy some of it" reading. The normalization is
-- idempotent: an already-migrated key computes to itself and is skipped.
--
-- SAFETY: additive column + backfill on the 13 seeded unit rows + one
-- create-or-replace function. No user rows are written by APPLYING this
-- migration; grocery rows change only when a regeneration next runs for a
-- plan (user-initiated via the Shop banner since milestone 10). The one-shot
-- state collapse (bool_and) is lossy by design for rows that merge — accepted
-- owner decision (spec §1, docs/plans/unit-merge.md).
--
-- APPLY ORDER: no dependent client change exists (the app reads
-- grocery_list_items rows and renders unit_code as-is), but the standing rule
-- holds: apply this migration to prod BEFORE merging the PR that carries it.
-- The old client keeps working against the new function unchanged.
--
-- PREFLIGHT (read-only — run in the SQL editor before applying):
--   -- 1. Every stored source_key parses as name|unit|flag (expect 0):
--   select count(*) from public.grocery_list_items
--   where source_key !~ '^(.*)\|([^|]*)\|([01])$';
--   -- 2. Rows that will collapse into a shared bucket (report the count to
--   --    the owner; these are the rows whose state merges via bool_and):
--   select coalesce(sum(members - 1), 0) as rows_merged_away, count(*) as buckets
--   from (
--     select g.meal_plan_id,
--            (regexp_match(g.source_key, '^(.*)\|([^|]*)\|([01])$'))[1]
--              || '|' || coalesce(
--                   (select case u.unit_type when 'volume' then 'vol'
--                                            when 'weight' then 'wt'
--                                            else u.code end
--                    from public.units u
--                    where u.code = (regexp_match(g.source_key, '^(.*)\|([^|]*)\|([01])$'))[2]),
--                   (regexp_match(g.source_key, '^(.*)\|([^|]*)\|([01])$'))[2])
--              || '|' || (regexp_match(g.source_key, '^(.*)\|([^|]*)\|([01])$'))[3] as new_key,
--            count(*) as members
--     from public.grocery_list_items g
--     group by 1, 2
--     having count(*) > 1
--   ) d;
--   -- 3. Unit vocabulary is exactly the 13 seeded codes (expect 13; a new
--   --    code added since would need its own base_factor before this runs):
--   select count(*) from public.units;
--
-- ROLLBACK / FORWARD-RECOVERY: restore the previous function body from
-- migration 20260702023356_grocery_state_preservation.sql (create or replace),
-- then optionally `alter table public.units drop column base_factor`. Rows
-- already merged by a regeneration cannot be un-merged (their per-unit state
-- collapsed); the next old-style regeneration simply rebuilds per-unit rows
-- arriving unchecked. No other data is at risk.

-- ---------------------------------------------------------------------------
-- 1. units.base_factor — exact US-customary definitions, base ml (volume),
--    g (weight), self (count). numeric(12,6); do not round further.
-- ---------------------------------------------------------------------------
alter table public.units add column if not exists base_factor numeric(12,6);

update public.units set base_factor = v.factor
from (values
  ('tsp',    4.928922),
  ('tbsp',  14.786765),
  ('cup',  236.588236),
  ('fl_oz', 29.573530),
  ('ml',     1.0),
  ('l',   1000.0),
  ('oz',    28.349523),
  ('lb',   453.592370),
  ('g',      1.0),
  ('kg',  1000.0),
  ('item',   1.0),
  ('clove',  1.0),
  ('slice',  1.0)
) as v(code, factor)
where units.code = v.code;

alter table public.units alter column base_factor set not null;

-- ---------------------------------------------------------------------------
-- 2. regenerate_grocery_list — dimension-aware buckets, largest-unit display,
--    in-place old-key normalization with bool_and state collapse.
--    Signature, security posture, lock behavior, and phase order (normalize ->
--    upsert -> delete-obsolete -> stamp) are unchanged from milestone 4.
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_grocery_list(p_plan_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_plan public.meal_plans%rowtype;
  v_rows integer;
begin
  -- Lock the plan row: serializes concurrent regenerations of the same plan
  -- and any concurrent item mutations (whose validation takes the same lock),
  -- so the aggregate below reads a consistent item set.
  select * into v_plan from public.meal_plans
   where id = p_plan_id
   for no key update;
  if not found then
    -- Under RLS an invisible plan reads as missing.
    raise exception 'meal plan % not found or not owned by the caller', p_plan_id;
  end if;

  -- One-time normalization of legacy 'v<version>|' prefixed keys (pre-M4
  -- rows), so every row below parses as name|unit|flag.
  update public.grocery_list_items
     set source_key = regexp_replace(source_key, '^v[0-9]+\|', '')
   where meal_plan_id = p_plan_id
     and source_key ~ '^v[0-9]+\|';

  -- Migrate surviving rows from the old identity (name|unit_code|flag) to the
  -- dimension identity (name|vol/wt/code|flag), preserving user state. The
  -- flag segment is carried over from the stored key, NOT recomputed from the
  -- row: the key holds the recipe-derived classification while the column is
  -- the mutable pantry override (milestone 4). Old rows whose new keys now
  -- collide collapse into the smallest-id row with bool_and state — checked /
  -- on-hand only if EVERY merged part was. Already-migrated keys compute to
  -- themselves, so this whole block is a no-op on normalized data.
  with keyed as (
    select g.id, g.is_checked, g.is_on_hand,
           k.parts[1] || '|'
             || coalesce(
                  (select case u.unit_type
                            when 'volume' then 'vol'
                            when 'weight' then 'wt'
                            else u.code
                          end
                   from public.units u
                   where u.code = k.parts[2]),
                  k.parts[2])
             || '|' || k.parts[3] as new_key
    from public.grocery_list_items g
    cross join lateral (select regexp_match(g.source_key, '^(.*)\|([^|]*)\|([01])$') as parts) k
    where g.meal_plan_id = p_plan_id
      and k.parts is not null
  ),
  grouped as (
    select new_key,
           -- smallest uuid; core Postgres has no min(uuid) aggregate
           (array_agg(id order by id))[1] as keep_id,
           bool_and(is_checked) as all_checked,
           bool_and(is_on_hand) as all_on_hand
    from keyed
    group by new_key
    having count(*) > 1
  ),
  collapsed as (
    update public.grocery_list_items g
       set is_checked = gr.all_checked,
           is_on_hand = gr.all_on_hand
      from grouped gr
     where g.id = gr.keep_id
     returning g.id
  )
  delete from public.grocery_list_items g
  using keyed k
  join grouped gr on gr.new_key = k.new_key
  where g.id = k.id
    and g.id <> gr.keep_id;

  -- Second pass over the survivors: stamp the migrated key. (Separate
  -- statement so the delete above and this update never touch the same row
  -- inside one statement's snapshot.)
  update public.grocery_list_items g
     set source_key = k.new_key
    from (
      select g2.id,
             p.parts[1] || '|'
               || coalesce(
                    (select case u.unit_type
                              when 'volume' then 'vol'
                              when 'weight' then 'wt'
                              else u.code
                            end
                     from public.units u
                     where u.code = p.parts[2]),
                    p.parts[2])
               || '|' || p.parts[3] as new_key
      from public.grocery_list_items g2
      cross join lateral (select regexp_match(g2.source_key, '^(.*)\|([^|]*)\|([01])$') as parts) p
      where g2.meal_plan_id = p_plan_id
        and p.parts is not null
    ) k
   where g.id = k.id
     and k.new_key is distinct from g.source_key;

  -- Upsert the fresh aggregate. Buckets group by normalized name + dimension
  -- ('vol'/'wt', or the unit code itself for count units) + recipe-derived
  -- pantry classification. Amounts are summed in the base unit
  -- (amount * serving_multiplier * base_factor) and displayed in the largest
  -- contributing unit, 3-decimal rounding. The DO UPDATE touches ONLY amount,
  -- display name, and unit_code (the display unit can legitimately change
  -- when a larger unit joins the bucket): is_checked, is_on_hand, and the
  -- (possibly overridden) is_pantry_staple are preserved.
  insert into public.grocery_list_items
    (meal_plan_id, ingredient_name, amount, unit_code, is_pantry_staple, source_key)
  select
    p_plan_id,
    min(btrim(i.name)),
    round((sum(i.amount * m.serving_multiplier * u.base_factor)
           / max(u.base_factor))::numeric, 3),
    (array_agg(i.unit_code order by u.base_factor desc))[1],
    i.is_pantry_staple,
    lower(btrim(i.name)) || '|'
      || case u.unit_type when 'volume' then 'vol'
                          when 'weight' then 'wt'
                          else i.unit_code end
      || '|' || case when i.is_pantry_staple then '1' else '0' end
  from public.meal_plan_items m
  join public.ingredients i on i.recipe_id = m.recipe_id
  join public.units u on u.code = i.unit_code
  where m.meal_plan_id = p_plan_id
    and m.slot_type = 'cook'
  group by lower(btrim(i.name)),
           case u.unit_type when 'volume' then 'vol'
                            when 'weight' then 'wt'
                            else i.unit_code end,
           i.is_pantry_staple
  on conflict (meal_plan_id, source_key) do update
    set amount = excluded.amount,
        ingredient_name = excluded.ingredient_name,
        unit_code = excluded.unit_code;

  -- Remove obsolete rows only after the replacement upsert succeeded (any
  -- failure above aborts the whole transaction, leaving the old list intact).
  delete from public.grocery_list_items g
  where g.meal_plan_id = p_plan_id
    and not exists (
      select 1
      from public.meal_plan_items m
      join public.ingredients i on i.recipe_id = m.recipe_id
      join public.units u on u.code = i.unit_code
      where m.meal_plan_id = p_plan_id
        and m.slot_type = 'cook'
        and lower(btrim(i.name)) || '|'
              || case u.unit_type when 'volume' then 'vol'
                                  when 'weight' then 'wt'
                                  else i.unit_code end
              || '|' || case when i.is_pantry_staple then '1' else '0' end
            = g.source_key
    );

  -- Stamp: this list now reflects the plan's current version.
  update public.meal_plans set groceries_version = version where id = p_plan_id;

  select count(*)::integer into v_rows
  from public.grocery_list_items where meal_plan_id = p_plan_id;
  return v_rows;
end;
$$;

-- Grants: none needed — create or replace on the identical signature keeps
-- the existing grant (authenticated, service_role) from milestone 4.
