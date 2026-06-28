-- 20260627222320_atomic_recipe_save.sql
-- Milestone 2 — Atomic Recipe Saves
--
-- Adds public.save_recipe(...): a single-transaction recipe upsert that replaces
-- the prior client/MCP "update parent, then delete-and-reinsert children" sequence.
-- Because the whole body runs in one transaction, any failed child write (e.g. a
-- bad unit_code FK or a step-number conflict) rolls back the ENTIRE save, so a
-- recipe can never be left partially updated.
--
-- It also keeps grocery lists honest: when an EXISTING recipe's ingredient set
-- changes, every meal plan that references the recipe has its `version` bumped.
-- Persisted grocery rows carry a `v<version>|...` source_key, so the grocery page
-- detects the mismatch and regenerates on next load (app/grocery/page.tsx).
-- base_servings is intentionally NOT part of the change check: grocery scaling uses
-- the plan item's serving_multiplier, not the recipe's base_servings (lib/grocery.ts).
--
-- SAFETY: Additive only. This migration creates one function plus its grants. It
-- does NOT alter, backfill, or delete any existing row, so no live data can be
-- rejected by applying it. The preflight below is therefore informational/sanity
-- only (no rows are at risk).
--
-- APPLY ORDER (the client hard-cuts to this RPC with no fallback — order matters):
--   1. Run the PREFLIGHT below.
--   2. Apply this migration; verify the function exists.
--   3. notify pgrst, 'reload schema';  (also at the end of this file)
--   4. THEN deploy / run the client (app/recipes/page.tsx) and switch the MCP tool.
--   Rollback: revert the CLIENT first, then drop the function (see ROLLBACK below).
--
-- PREFLIGHT (read-only — run in the Supabase SQL editor before applying):
--   -- 1. Existing overloads. `create or replace` only replaces an identical
--   --    signature; a differing overload would coexist. Expect 0 rows (first run):
--   --      select p.oid::regprocedure as signature
--   --      from pg_proc p
--   --      join pg_namespace n on n.oid = p.pronamespace
--   --      where n.nspname = 'public' and p.proname = 'save_recipe';
--   -- 2. Sanity snapshot. These counts must be UNCHANGED after applying (the
--   --    migration creates a function only; it writes no data):
--   --      select
--   --        (select count(*) from public.recipes)      as recipes,
--   --        (select count(*) from public.ingredients)  as ingredients,
--   --        (select count(*) from public.recipe_steps) as steps,
--   --        (select count(*) from public.recipe_tags)  as recipe_tags,
--   --        (select count(*) from public.meal_plans)   as meal_plans;
--
-- ROLLBACK / FORWARD-RECOVERY: drop the function. Do this together with reverting
-- the client + MCP code that calls it, so callers never reference a missing
-- function. Dropping the function destroys no data:
--   --   drop function if exists
--   --     public.save_recipe(uuid, text, numeric, text, jsonb, jsonb, jsonb, uuid);

create or replace function public.save_recipe(
  p_recipe_id        uuid,
  p_name             text,
  p_base_servings    numeric,
  p_instructions_raw text,
  p_ingredients      jsonb,
  p_steps            jsonb,
  p_tags             jsonb,
  p_user_id          uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id         uuid;
  v_recipe_id       uuid;
  v_is_update       boolean := false;
  v_old_ingredients text[];
  v_new_ingredients text[];
begin
  -- Resolve the owner. App path: auth.uid() comes from the request JWT and RLS
  -- enforces ownership. Service-role MCP path: auth.uid() is null, so the trusted
  -- caller supplies p_user_id (the documented, deliberate RLS-bypass exception).
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    raise exception 'save_recipe: no authenticated user and no p_user_id provided';
  end if;
  if auth.uid() is not null and p_user_id is not null and p_user_id <> auth.uid() then
    raise exception 'save_recipe: p_user_id (%) does not match the authenticated user', p_user_id;
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'save_recipe: recipe name is required';
  end if;

  -- Upsert the recipe parent.
  if p_recipe_id is null then
    insert into public.recipes (user_id, name, base_servings, instructions_raw)
    values (
      v_user_id,
      btrim(p_name),
      coalesce(p_base_servings, 2),
      nullif(btrim(coalesce(p_instructions_raw, '')), '')
    )
    returning id into v_recipe_id;
  else
    v_is_update := true;
    update public.recipes
       set name             = btrim(p_name),
           base_servings    = coalesce(p_base_servings, 2),
           instructions_raw = nullif(btrim(coalesce(p_instructions_raw, '')), '')
     where id = p_recipe_id
       and user_id = v_user_id
    returning id into v_recipe_id;

    if v_recipe_id is null then
      raise exception 'save_recipe: recipe % not found or not owned by the caller', p_recipe_id;
    end if;
  end if;

  -- Capture the existing ingredient identity set BEFORE replacing it, to detect a
  -- grocery-relevant change. The signature covers what determines the generated
  -- grocery rows: normalized name, unit, and pantry flag (buildGroceryRows' bucket
  -- key) PLUS amount, which sets the summed quantity for that bucket.
  if v_is_update then
    select coalesce(array_agg(sig order by sig), array[]::text[])
      into v_old_ingredients
    from (
      select lower(btrim(name)) || '|' || amount::text || '|' || unit_code || '|' || is_pantry_staple::text as sig
      from public.ingredients
      where recipe_id = v_recipe_id
    ) old_ings;
  end if;

  -- Replace all child rows for this recipe.
  delete from public.ingredients  where recipe_id = v_recipe_id;
  delete from public.recipe_steps where recipe_id = v_recipe_id;
  delete from public.recipe_tags  where recipe_id = v_recipe_id;

  -- Ingredients (skip blank names; mirrors the client's filter). A bad unit_code
  -- FK or negative amount here aborts the whole function -> full rollback.
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
  select
    v_recipe_id,
    btrim(ing->>'name'),
    coalesce((ing->>'amount')::numeric, 0),
    ing->>'unit_code',
    coalesce((ing->>'is_pantry_staple')::boolean, false)
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) as ing
  where btrim(coalesce(ing->>'name', '')) <> '';

  -- Steps (skip blank bodies; renumber 1..N in input order).
  insert into public.recipe_steps (recipe_id, step_number, body)
  select v_recipe_id, (row_number() over (order by ord))::int, body
  from (
    select btrim(step_body) as body, ord
    from jsonb_array_elements_text(coalesce(p_steps, '[]'::jsonb)) with ordinality as t(step_body, ord)
    where btrim(coalesce(step_body, '')) <> ''
  ) kept_steps;

  -- Tags: normalize, upsert into the per-user tag table, then link. Two separate
  -- statements because a data-modifying CTE's inserts are not visible to the rest
  -- of the same statement.
  insert into public.tags (user_id, name)
  select distinct v_user_id, lower(btrim(tag))
  from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as tag
  where btrim(coalesce(tag, '')) <> ''
  on conflict (user_id, name) do nothing;

  insert into public.recipe_tags (recipe_id, tag_id)
  select v_recipe_id, t.id
  from public.tags t
  where t.user_id = v_user_id
    and t.name in (
      select distinct lower(btrim(tag))
      from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as tag
      where btrim(coalesce(tag, '')) <> ''
    );

  -- Grocery invalidation: if an existing recipe's ingredient set changed, bump the
  -- version of every plan that references it so its persisted grocery list is seen
  -- as stale (and regenerated) on next load. New recipes have no referencing plans.
  if v_is_update then
    select coalesce(array_agg(sig order by sig), array[]::text[])
      into v_new_ingredients
    from (
      select lower(btrim(name)) || '|' || amount::text || '|' || unit_code || '|' || is_pantry_staple::text as sig
      from public.ingredients
      where recipe_id = v_recipe_id
    ) new_ings;

    if v_old_ingredients is distinct from v_new_ingredients then
      -- Owner-scoped for defense-in-depth: redundant under RLS on the app path, but
      -- it keeps the service-role (RLS-bypassing) MCP path from ever touching another
      -- owner's plans.
      update public.meal_plans
         set version = version + 1
       where user_id = v_user_id
         and id in (
           select distinct meal_plan_id
           from public.meal_plan_items
           where recipe_id = v_recipe_id
         );
    end if;
  end if;

  return v_recipe_id;
end;
$$;

grant execute on function public.save_recipe(uuid, text, numeric, text, jsonb, jsonb, jsonb, uuid)
  to authenticated, service_role;

-- Make PostgREST pick up the new function immediately. Supabase's DDL event trigger
-- also reloads the schema cache within ~1-2s; running this explicitly avoids a
-- transient PGRST202 ("function not found") 404 on the very first save.
notify pgrst, 'reload schema';
