-- Enable extensions
create extension if not exists pgcrypto;

-- Controlled units for V1 exact-match combining
create table if not exists public.units (
  code text primary key,
  label text not null,
  unit_type text not null check (unit_type in ('volume', 'weight', 'count', 'other')),
  created_at timestamptz not null default now()
);

insert into public.units (code, label, unit_type)
values
  ('tsp', 'teaspoon', 'volume'),
  ('tbsp', 'tablespoon', 'volume'),
  ('cup', 'cup', 'volume'),
  ('fl_oz', 'fluid ounce', 'volume'),
  ('ml', 'milliliter', 'volume'),
  ('l', 'liter', 'volume'),
  ('oz', 'ounce', 'weight'),
  ('lb', 'pound', 'weight'),
  ('g', 'gram', 'weight'),
  ('kg', 'kilogram', 'weight'),
  ('item', 'item', 'count'),
  ('clove', 'clove', 'count'),
  ('slice', 'slice', 'count')
on conflict (code) do nothing;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_plan_days integer not null default 7 check (default_plan_days between 1 and 21),
  week_starts_on integer not null default 5 check (week_starts_on between 0 and 6),
  default_order_weekday integer check (default_order_weekday between 0 and 6),
  default_pickup_weekday integer check (default_pickup_weekday between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_servings numeric(6,2) not null default 2,
  instructions_raw text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  body text not null,
  created_at timestamptz not null default now(),
  unique (recipe_id, step_number)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  amount numeric(10,3) not null check (amount >= 0),
  unit_code text not null references public.units(code),
  is_pantry_staple boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, tag_id)
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  order_date date,
  pickup_date date,
  version integer not null default 1,
  -- Plan version the current grocery list was generated from (milestone 4);
  -- NULL = never generated => stale. See regenerate_grocery_list().
  groceries_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  plan_date date not null,
  meal_type text not null check (meal_type in ('lunch', 'dinner')),
  slot_type text not null default 'cook' check (slot_type in ('cook', 'leftover', 'eat_out')),
  recipe_id uuid references public.recipes(id) on delete cascade,
  leftover_from_item_id uuid references public.meal_plan_items(id) on delete set null,
  note text,
  serving_multiplier numeric(8,3) not null default 1 check (serving_multiplier > 0),
  created_at timestamptz not null default now(),
  -- eat_out slots carry no recipe; cook/leftover slots require one.
  constraint meal_plan_items_slot_recipe_check check (
    (slot_type = 'eat_out' and recipe_id is null)
    or (slot_type in ('cook', 'leftover') and recipe_id is not null)
  ),
  -- Only leftover slots may point at a source item.
  constraint meal_plan_items_leftover_link_check check (
    (slot_type = 'leftover')
    or (slot_type <> 'leftover' and leftover_from_item_id is null)
  )
);

-- Persisted grocery rows keep checklist state stable until regeneration.
create table if not exists public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  ingredient_name text not null,
  amount numeric(12,3) not null,
  unit_code text not null references public.units(code),
  is_pantry_staple boolean not null default false,
  is_on_hand boolean not null default false,
  is_checked boolean not null default false,
  source_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists meal_plans_user_id_idx on public.meal_plans(user_id);
create index if not exists recipes_user_id_idx on public.recipes(user_id);
create index if not exists tags_user_id_idx on public.tags(user_id);
create index if not exists meal_plan_items_meal_plan_id_idx on public.meal_plan_items(meal_plan_id);
create index if not exists meal_plan_items_slot_type_idx on public.meal_plan_items(slot_type);
create index if not exists meal_plan_items_leftover_from_item_id_idx on public.meal_plan_items(leftover_from_item_id);
create index if not exists grocery_list_items_meal_plan_id_idx on public.grocery_list_items(meal_plan_id);
-- Updated at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_user_settings on public.user_settings;
create trigger set_updated_at_user_settings
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_recipes on public.recipes;
create trigger set_updated_at_recipes
before update on public.recipes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_meal_plans on public.meal_plans;
create trigger set_updated_at_meal_plans
before update on public.meal_plans
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.ingredients enable row level security;
alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.grocery_list_items enable row level security;

drop policy if exists "user_settings_owner" on public.user_settings;
create policy "user_settings_owner" on public.user_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipes_owner" on public.recipes;
create policy "recipes_owner" on public.recipes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipe_steps_owner" on public.recipe_steps;
create policy "recipe_steps_owner" on public.recipe_steps
for all using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()
  )
);

drop policy if exists "ingredients_owner" on public.ingredients;
create policy "ingredients_owner" on public.ingredients
for all using (
  exists (
    select 1 from public.recipes r
    where r.id = ingredients.recipe_id and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.recipes r
    where r.id = ingredients.recipe_id and r.user_id = auth.uid()
  )
);

drop policy if exists "tags_owner" on public.tags;
create policy "tags_owner" on public.tags
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipe_tags_owner" on public.recipe_tags;
create policy "recipe_tags_owner" on public.recipe_tags
for all using (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_tags.recipe_id and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.recipes r
    where r.id = recipe_tags.recipe_id and r.user_id = auth.uid()
  )
);

drop policy if exists "meal_plans_owner" on public.meal_plans;
create policy "meal_plans_owner" on public.meal_plans
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_plan_items_owner" on public.meal_plan_items;
create policy "meal_plan_items_owner" on public.meal_plan_items
for all using (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = meal_plan_items.meal_plan_id and mp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = meal_plan_items.meal_plan_id and mp.user_id = auth.uid()
  )
);

drop policy if exists "grocery_list_items_owner" on public.grocery_list_items;
create policy "grocery_list_items_owner" on public.grocery_list_items
for all using (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = grocery_list_items.meal_plan_id and mp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.meal_plans mp
    where mp.id = grocery_list_items.meal_plan_id and mp.user_id = auth.uid()
  )
);

-- Units are globally readable.
alter table public.units enable row level security;
drop policy if exists "units_read_all" on public.units;
create policy "units_read_all" on public.units
for select using (true);

-- Explicit Data API grants (added by migration 20260701220327_data_api_grants.sql).
-- Supabase's legacy implicit default privileges are no longer granted on fresh
-- stacks (auto_expose_new_tables default flip, 2026-05-30), so the grants the
-- app relies on are declared explicitly. RLS remains the security gate; these
-- are the coarse capability layer beneath it. No sequence grants are needed
-- (uuid keys via gen_random_uuid(); no serial/identity sequences).
grant select, insert, update, delete on table
  public.recipes,
  public.ingredients,
  public.recipe_steps,
  public.recipe_tags,
  public.tags,
  public.meal_plans,
  public.meal_plan_items,
  public.user_settings,
  public.grocery_list_items
to authenticated, service_role;

grant select on table public.units to anon, authenticated, service_role;

-- Atomic recipe save (added by migration 20260627222320_atomic_recipe_save.sql).
-- Single-transaction recipe upsert used by the web client and the MCP save-recipe
-- tool; replaces the prior client-side delete-then-reinsert sequence so a failed
-- child write rolls back the whole save. When an existing recipe's ingredient set
-- changes, it bumps the version of every plan that references the recipe so the
-- persisted grocery list (source_key carries v<version>|) is detected as stale.
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
  -- App path: auth.uid() from the JWT, RLS enforces ownership. Service-role MCP
  -- path: auth.uid() is null, so the trusted caller supplies p_user_id.
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

  -- Capture the existing ingredient identity set before replacing it. The signature
  -- covers what determines the generated grocery rows: normalized name, unit, and
  -- pantry flag (buildGroceryRows' bucket key) PLUS amount (the summed quantity).
  if v_is_update then
    select coalesce(array_agg(sig order by sig), array[]::text[])
      into v_old_ingredients
    from (
      select lower(btrim(name)) || '|' || amount::text || '|' || unit_code || '|' || is_pantry_staple::text as sig
      from public.ingredients
      where recipe_id = v_recipe_id
    ) old_ings;
  end if;

  delete from public.ingredients  where recipe_id = v_recipe_id;
  delete from public.recipe_steps where recipe_id = v_recipe_id;
  delete from public.recipe_tags  where recipe_id = v_recipe_id;

  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
  select
    v_recipe_id,
    btrim(ing->>'name'),
    coalesce((ing->>'amount')::numeric, 0),
    ing->>'unit_code',
    coalesce((ing->>'is_pantry_staple')::boolean, false)
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) as ing
  where btrim(coalesce(ing->>'name', '')) <> '';

  insert into public.recipe_steps (recipe_id, step_number, body)
  select v_recipe_id, (row_number() over (order by ord))::int, body
  from (
    select btrim(step_body) as body, ord
    from jsonb_array_elements_text(coalesce(p_steps, '[]'::jsonb)) with ordinality as t(step_body, ord)
    where btrim(coalesce(step_body, '')) <> ''
  ) kept_steps;

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



-- Plan integrity (added by migration 20260702001350_plan_integrity.sql).
-- Trigger-based, grocery-scoped version bumps (replaces the client's racy
-- read-then-write sequence) and cross-row validation that CHECK constraints
-- cannot express: plan_date within the plan range, same-owner recipe refs,
-- same-plan cook-sourced leftover links, protected cook items, and plan
-- ranges that cannot shrink past existing items.
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

-- Grocery state preservation (added by migration 20260702023356_grocery_state_preservation.sql).
-- Transactional, state-preserving grocery regeneration: upserts by the stable
-- row identity (name|unit|pantry, no version prefix), preserving is_checked /
-- is_on_hand / pantry overrides for surviving rows; obsolete rows are removed
-- only after the upsert succeeds; staleness = meal_plans.groceries_version
-- distinct from version.
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
