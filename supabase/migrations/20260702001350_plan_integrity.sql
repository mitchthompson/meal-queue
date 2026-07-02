-- 20260702001350_plan_integrity.sql
-- Milestone 3 — Plan Integrity
--
-- 1. Moves meal-plan version increments from the client's read-then-write
--    sequence (racy; loses concurrent increments) into an AFTER trigger on
--    meal_plan_items. The bump is a single atomic
--    `update ... set version = version + 1`, serialized by the row lock, so
--    concurrent mutations cannot lose increments. The bump is SCOPED to
--    grocery-relevant changes only (cook items appearing/disappearing, or a
--    cook item's recipe/serving multiplier changing) — grocery generation
--    reads only slot_type='cook' rows (recipe_id, serving_multiplier), so
--    note/leftover/eat-out edits no longer invalidate the shopping checklist.
--    This extends the milestone-2 decision (diff-based recipe bumps) and
--    resolves the "over-triggered regeneration" design flag at the root.
-- 2. Adds BEFORE-trigger validation that CHECK constraints cannot express
--    (cross-row / cross-table):
--      - meal_plan_items.plan_date must lie within the parent plan's range;
--      - a referenced recipe must belong to the plan's owner;
--      - a non-null leftover link must point at a slot_type='cook' item in
--        the SAME plan (verified: the UI can only construct same-plan links;
--        live data has 0 cross-plan / non-cook links);
--      - a cook item cannot change slot_type away from 'cook' while leftovers
--        still reference it;
--      - a plan's date range cannot shrink past its existing items.
--    NULL leftover links stay legal: deleting a cook item nulls its
--    dependents' links by FK (on delete set null) — live data has 2 such
--    orphans and they are valid history.
--
-- The trigger functions are SECURITY INVOKER (default): under the app path
-- they run as `authenticated`, where RLS makes another owner's recipe
-- invisible — the owner check then reports it as not found, which is the
-- correct, non-leaking rejection. The service-role path sees all rows and the
-- explicit owner comparison still enforces integrity.
--
-- APPLY ORDER (matters — the reverse creates silently stale grocery lists):
--   1. Run the PREFLIGHT below against prod.
--   2. Apply this migration to prod.
--   3. THEN merge/deploy the client change that removes bumpPlanVersion.
--   During the window between 2 and 3 both the old client AND the trigger
--   bump versions (harmless over-bump: at worst one extra grocery
--   regeneration). Deploying the client FIRST would leave a window with NO
--   bumps at all — plan edits would silently stop invalidating grocery lists.
--
-- ACCEPTED, DOCUMENTED NON-ISSUES:
--   - Deadlock surface: transactions that bump MULTIPLE plans (save_recipe
--     ingredient diffs; recipe deletion cascading cook items across plans)
--     acquire meal_plans row locks in scan order. Two overlapping multi-plan
--     transactions could deadlock; Postgres resolves it by aborting one, the
--     whole transaction rolls back cleanly, and no increments are lost.
--     Negligible for a single household; revisit only if it ever surfaces.
--   - meal_plans.updated_at now also advances on trigger bumps (the existing
--     set_updated_at trigger fires on the version UPDATE), so it means "plan
--     or its grocery-relevant items changed", not "plan meta edited".
--   - TRUNCATE meal_plan_items would bypass the row triggers (no bump). No
--     app path truncates; manual maintenance should bump versions manually.
--   - Under invoker RLS the bump UPDATE only touches plans visible to the
--     caller — for the app path that is exactly the owner's plans; hostile
--     callers are rejected earlier by validation.
--
-- SAFETY: Additive only (functions + triggers). No rows are written, altered,
-- or deleted by applying this migration. Existing data was preflighted against
-- every new rule on 2026-07-01 (results in comments below).
--
-- PREFLIGHT (read-only — run before applying; all must return 0 except the
-- noted informational rows):
--   select 'items outside plan date range', count(*)               -- live: 0
--   from public.meal_plan_items i
--   join public.meal_plans p on p.id = i.meal_plan_id
--   where i.plan_date < p.start_date or i.plan_date > p.end_date
--   union all
--   select 'cross-owner recipe refs', count(*)                     -- live: 0
--   from public.meal_plan_items i
--   join public.meal_plans p on p.id = i.meal_plan_id
--   join public.recipes r on r.id = i.recipe_id
--   where r.user_id <> p.user_id
--   union all
--   select 'leftover links to non-cook items', count(*)            -- live: 0
--   from public.meal_plan_items l
--   join public.meal_plan_items src on src.id = l.leftover_from_item_id
--   where l.slot_type = 'leftover' and src.slot_type <> 'cook'
--   union all
--   select 'leftover links across plans', count(*)                 -- live: 0
--   from public.meal_plan_items l
--   join public.meal_plan_items src on src.id = l.leftover_from_item_id
--   where l.slot_type = 'leftover' and src.meal_plan_id <> l.meal_plan_id
--   union all
--   select 'orphan leftovers (null link, INFORMATIONAL — allowed)', count(*)
--   from public.meal_plan_items                                    -- live: 2
--   where slot_type = 'leftover' and leftover_from_item_id is null;
--
-- ROLLBACK — order matters, mirror of APPLY ORDER: FIRST revert/redeploy the
-- client (restoring its own version bumping), THEN drop the triggers and
-- functions. Dropping the triggers while the trigger-reliant client is live
-- would stop version bumps entirely (silently stale grocery lists).
--   drop trigger if exists validate_meal_plan_item on public.meal_plan_items;
--   drop trigger if exists protect_plan_range on public.meal_plans;
--   drop trigger if exists bump_plan_version on public.meal_plan_items;
--   drop function if exists public.validate_meal_plan_item();
--   drop function if exists public.protect_plan_range();
--   drop function if exists public.bump_plan_version_on_grocery_change();

-- Cross-row / cross-table validation for meal-plan items.
create or replace function public.validate_meal_plan_item()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_plan   public.meal_plans%rowtype;
  v_source public.meal_plan_items%rowtype;
  v_recipe_owner uuid;
begin
  -- Lock the plan row (FOR NO KEY UPDATE) while validating: without it, an
  -- item insert racing a concurrent range-shrink could validate against the
  -- old range while the shrink's count cannot see the uncommitted item (write
  -- skew) — both would commit and strand the item. The FK alone only takes
  -- FOR KEY SHARE, which does not conflict with a non-key UPDATE. NOT FOR
  -- SHARE: the later bump UPDATE would be a lock upgrade and could deadlock.
  select * into v_plan from public.meal_plans
   where id = new.meal_plan_id
   for no key update;
  if not found then
    -- Under RLS an invisible plan reads as missing; FK would reject it anyway.
    raise exception 'meal plan % not found or not owned by the caller', new.meal_plan_id;
  end if;

  if new.plan_date < v_plan.start_date or new.plan_date > v_plan.end_date then
    raise exception 'plan_date % is outside the plan range % to %',
      new.plan_date, v_plan.start_date, v_plan.end_date;
  end if;

  if new.recipe_id is not null then
    select user_id into v_recipe_owner from public.recipes where id = new.recipe_id;
    if v_recipe_owner is null or v_recipe_owner <> v_plan.user_id then
      raise exception 'recipe % not found or not owned by the plan owner', new.recipe_id;
    end if;
  end if;

  if new.slot_type = 'leftover' and new.leftover_from_item_id is not null then
    -- FOR SHARE: serializes against a concurrent slot_type change on the
    -- source row (safe here — this transaction never writes the source, so no
    -- lock upgrade follows).
    select * into v_source from public.meal_plan_items
     where id = new.leftover_from_item_id
     for share;
    if not found then
      raise exception 'leftover source item % not found', new.leftover_from_item_id;
    end if;
    if v_source.slot_type <> 'cook' then
      raise exception 'leftover must reference a cooked item (source % is %)',
        v_source.id, v_source.slot_type;
    end if;
    if v_source.meal_plan_id <> new.meal_plan_id then
      raise exception 'leftover must reference an item in the same plan';
    end if;
  end if;

  -- A cook item that other items reference as their leftover source can
  -- neither stop being a cook item NOR move to another plan (a move would
  -- strand its dependents with cross-plan links). Deleting it remains
  -- allowed: the FK nulls the dependents' links, which is established, valid
  -- history.
  if tg_op = 'UPDATE' and old.slot_type = 'cook'
     and (new.slot_type <> 'cook' or new.meal_plan_id is distinct from old.meal_plan_id) then
    if exists (select 1 from public.meal_plan_items d where d.leftover_from_item_id = old.id) then
      raise exception 'item % is referenced by leftovers and must stay a cooked item in its plan', old.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_meal_plan_item on public.meal_plan_items;
create trigger validate_meal_plan_item
before insert or update on public.meal_plan_items
for each row execute function public.validate_meal_plan_item();

-- A plan's date range cannot shrink past its existing items.
create or replace function public.protect_plan_range()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_stranded integer;
begin
  if new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date then
    select count(*) into v_stranded
    from public.meal_plan_items i
    where i.meal_plan_id = new.id
      and (i.plan_date < new.start_date or i.plan_date > new.end_date);
    if v_stranded > 0 then
      raise exception 'new plan range % to % would strand % planned item(s)',
        new.start_date, new.end_date, v_stranded;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_plan_range on public.meal_plans;
create trigger protect_plan_range
before update on public.meal_plans
for each row execute function public.protect_plan_range();

-- Scoped version bump: only grocery-relevant item changes advance the plan
-- version. Grocery generation consumes slot_type='cook' rows (recipe_id,
-- serving_multiplier); nothing else affects the list.
create or replace function public.bump_plan_version_on_grocery_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_relevant boolean := false;
begin
  if tg_op = 'INSERT' then
    v_relevant := new.slot_type = 'cook';
    if v_relevant then
      update public.meal_plans set version = version + 1 where id = new.meal_plan_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    v_relevant := old.slot_type = 'cook';
    if v_relevant then
      update public.meal_plans set version = version + 1 where id = old.meal_plan_id;
    end if;
    return old;
  else -- UPDATE: relevant when the cook-facing shape of the row changed.
    v_relevant :=
      (old.slot_type = 'cook' or new.slot_type = 'cook')
      and (old.slot_type is distinct from new.slot_type
           or old.recipe_id is distinct from new.recipe_id
           or old.serving_multiplier is distinct from new.serving_multiplier
           or old.meal_plan_id is distinct from new.meal_plan_id);
    if v_relevant then
      update public.meal_plans set version = version + 1 where id = new.meal_plan_id;
      if old.meal_plan_id is distinct from new.meal_plan_id then
        update public.meal_plans set version = version + 1 where id = old.meal_plan_id;
      end if;
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists bump_plan_version on public.meal_plan_items;
create trigger bump_plan_version
after insert or update or delete on public.meal_plan_items
for each row execute function public.bump_plan_version_on_grocery_change();
