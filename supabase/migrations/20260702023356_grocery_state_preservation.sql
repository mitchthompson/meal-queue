-- 20260702023356_grocery_state_preservation.sql
-- Milestone 4 — Grocery State Preservation
--
-- Replaces the client's delete-everything-and-reinsert grocery regeneration
-- with a single transactional function that UPSERTS by a stable row identity,
-- so regeneration:
--   - never exposes a partially rebuilt list (one transaction),
--   - preserves user state (is_checked, is_on_hand, and the manual pantry
--     override) for every ingredient that survives the regeneration,
--   - updates amounts in place, adds new rows unchecked, and removes obsolete
--     rows only after the replacement upsert has succeeded.
--
-- IDENTITY: source_key becomes the stable identity WITHOUT the old version
-- prefix: lower(trim(name)) || '|' || unit_code || '|' || pantry-classification
-- (exactly buildGroceryRows' bucket key). The recipe-derived classification is
-- part of the identity; the row's is_pantry_staple column remains the mutable
-- display value so the UI's pantry override survives regeneration. Staleness
-- moves from source-key prefix comparison to a new meal_plans.groceries_version
-- column: the list is stale when groceries_version is distinct from version
-- (which milestone 3's triggers bump only on grocery-relevant changes).
--
-- APPLY ORDER: apply this migration to prod BEFORE merging the client change.
-- The old client keeps doing delete-and-reinsert with v-prefixed keys, which
-- stays valid under the new unique index (one generation per plan at a time)
-- and simply leaves groceries_version stale — the new client then does one
-- state-preserving regeneration. The reverse order would break the client
-- (calling a function that does not exist yet).
--
-- PREFLIGHT (read-only — run before applying; live results 2026-07-02):
--   -- 1. Stripped identities must be unique per plan (expect 0):     -- live: 0
--   select count(*) from (
--     select meal_plan_id, regexp_replace(source_key, '^v[0-9]+\|', '') as ident
--     from public.grocery_list_items group by 1, 2 having count(*) > 1) d;
--   -- 2. Sanity: rows total / v-prefixed (expect equal):        -- live: 783/783
--   select count(*), count(*) filter (where source_key ~ '^v[0-9]+\|')
--   from public.grocery_list_items;
--   -- 3. Plans whose list matches their current version (backfilled to
--   --    groceries_version = version below; others stay NULL and regenerate
--   --    state-preservingly on next visit):                       -- live: 18/19
--   select count(*) from (
--     select g.meal_plan_id from public.grocery_list_items g
--     join public.meal_plans p on p.id = g.meal_plan_id
--     group by g.meal_plan_id, p.version
--     having bool_and(g.source_key like 'v'||p.version||'|%')) c;
--
-- ROLLBACK — revert the client FIRST (restoring its own delete/reinsert
-- regeneration), THEN:
--   drop function if exists public.regenerate_grocery_list(uuid);
--   drop index if exists grocery_list_items_plan_source_key_uidx;
--   alter table public.meal_plans drop column if exists groceries_version;
-- Dropping the column loses only staleness bookkeeping, no user data.

-- Staleness bookkeeping: the plan version the current grocery list was
-- generated from. NULL = unknown/never generated => treated as stale.
alter table public.meal_plans
add column if not exists groceries_version integer;

-- Backfill: lists whose rows all carry the current version's prefix are
-- up to date; stamp them so they do not needlessly regenerate once.
update public.meal_plans p
set groceries_version = p.version
where p.groceries_version is null
  and exists (select 1 from public.grocery_list_items g where g.meal_plan_id = p.id)
  and not exists (
    select 1 from public.grocery_list_items g
    where g.meal_plan_id = p.id
      and g.source_key not like 'v' || p.version || '|%'
  );

-- Row identity is unique within a plan (verified on live data, including with
-- legacy prefixes stripped). Enables the atomic upsert below.
create unique index if not exists grocery_list_items_plan_source_key_uidx
on public.grocery_list_items (meal_plan_id, source_key);

-- Transactional, state-preserving grocery regeneration.
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

  -- One-time normalization of legacy 'v<version>|' prefixed keys, so rows
  -- generated before this migration match the stable identity and keep their
  -- user state through their first new-style regeneration.
  update public.grocery_list_items
     set source_key = regexp_replace(source_key, '^v[0-9]+\|', '')
   where meal_plan_id = p_plan_id
     and source_key ~ '^v[0-9]+\|';

  -- Upsert the fresh aggregate (same semantics as lib/grocery.ts
  -- buildGroceryRows: cook items only, amounts scaled by serving multiplier,
  -- grouped by normalized name + unit + pantry classification, 3-decimal
  -- rounding, display name = trimmed original). The DO UPDATE deliberately
  -- touches ONLY amount and display name: is_checked, is_on_hand, and the
  -- (possibly overridden) is_pantry_staple are preserved.
  insert into public.grocery_list_items
    (meal_plan_id, ingredient_name, amount, unit_code, is_pantry_staple, source_key)
  select
    p_plan_id,
    min(btrim(i.name)),
    round(sum(i.amount * m.serving_multiplier)::numeric, 3),
    i.unit_code,
    i.is_pantry_staple,
    lower(btrim(i.name)) || '|' || i.unit_code || '|'
      || case when i.is_pantry_staple then '1' else '0' end
  from public.meal_plan_items m
  join public.ingredients i on i.recipe_id = m.recipe_id
  where m.meal_plan_id = p_plan_id
    and m.slot_type = 'cook'
  group by lower(btrim(i.name)), i.unit_code, i.is_pantry_staple
  on conflict (meal_plan_id, source_key) do update
    set amount = excluded.amount,
        ingredient_name = excluded.ingredient_name;

  -- Remove obsolete rows only after the replacement upsert succeeded (any
  -- failure above aborts the whole transaction, leaving the old list intact).
  delete from public.grocery_list_items g
  where g.meal_plan_id = p_plan_id
    and not exists (
      select 1
      from public.meal_plan_items m
      join public.ingredients i on i.recipe_id = m.recipe_id
      where m.meal_plan_id = p_plan_id
        and m.slot_type = 'cook'
        and lower(btrim(i.name)) || '|' || i.unit_code || '|'
              || case when i.is_pantry_staple then '1' else '0' end = g.source_key
    );

  -- Stamp: this list now reflects the plan's current version.
  update public.meal_plans set groceries_version = version where id = p_plan_id;

  select count(*)::integer into v_rows
  from public.grocery_list_items where meal_plan_id = p_plan_id;
  return v_rows;
end;
$$;

grant execute on function public.regenerate_grocery_list(uuid)
  to authenticated, service_role;
