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
  created_at timestamptz not null default now()
);

-- Allow multiple recipes per meal slot (e.g. dinner mains + sides).
drop index if exists meal_plan_items_unique_slot_idx;

alter table public.meal_plan_items
add column if not exists slot_type text not null default 'cook' check (slot_type in ('cook', 'leftover', 'eat_out'));

alter table public.meal_plan_items
add column if not exists leftover_from_item_id uuid references public.meal_plan_items(id) on delete set null;

alter table public.meal_plan_items
add column if not exists note text;

alter table public.meal_plan_items
alter column recipe_id drop not null;

update public.meal_plan_items
set slot_type = 'cook'
where slot_type is null;

alter table public.meal_plan_items
drop constraint if exists meal_plan_items_slot_recipe_check;

alter table public.meal_plan_items
add constraint meal_plan_items_slot_recipe_check
check (
  (slot_type = 'eat_out' and recipe_id is null)
  or (slot_type in ('cook', 'leftover') and recipe_id is not null)
);

alter table public.meal_plan_items
drop constraint if exists meal_plan_items_leftover_link_check;

alter table public.meal_plan_items
add constraint meal_plan_items_leftover_link_check
check (
  (slot_type = 'leftover')
  or (slot_type <> 'leftover' and leftover_from_item_id is null)
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

alter table public.grocery_list_items
add column if not exists is_on_hand boolean not null default false;

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


