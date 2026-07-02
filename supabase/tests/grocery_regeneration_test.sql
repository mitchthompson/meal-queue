-- supabase/tests/grocery_regeneration_test.sql
--
-- pgTAP coverage for Milestone 4 (Grocery State Preservation), migration
-- 20260702023356_grocery_state_preservation.sql:
--   - transactional regeneration via public.regenerate_grocery_list(),
--   - stable identity keys (no version prefix), exact-match aggregation,
--   - preservation of is_checked / is_on_hand / pantry override for
--     surviving rows; removed ingredients disappear; added arrive unchecked,
--   - legacy 'v<n>|' prefixed rows are normalized and keep their state,
--   - groceries_version staleness stamping (pairs with milestone 3 bumps),
--   - RLS: another user cannot regenerate the owner's plan.
--
-- House choreography: one begin/rollback; postgres for fixtures + verification
-- reads; `authenticated` + JWT claims for the app path.

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser).
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'grocery-a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'grocery-b@test.local');

do $$
declare v_r1 uuid; v_r2 uuid; v_plan uuid; v_i1 uuid;
begin
  insert into public.recipes (user_id, name, base_servings)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chicken Dinner', 2)
  returning id into v_r1;
  perform set_config('test.r1', v_r1::text, true);
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (v_r1, 'Chicken', 1,   'lb',   false),
    (v_r1, 'Salt',    1,   'tsp',  true),
    (v_r1, 'Oil',     2,   'tbsp', true);

  insert into public.recipes (user_id, name, base_servings)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Chicken Rice', 2)
  returning id into v_r2;
  perform set_config('test.r2', v_r2::text, true);
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (v_r2, 'chicken', 0.5, 'lb',  false),   -- same identity as R1's Chicken
    (v_r2, 'Rice',    1,   'cup', false);

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-01', '2026-07-07')
  returning id into v_plan;
  perform set_config('test.gplan', v_plan::text, true);

  -- two cook items: M3 triggers bump version 1 -> 3
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_plan, '2026-07-01', 'dinner', 'cook', v_r1, 2)
  returning id into v_i1;
  perform set_config('test.gitem1', v_i1::text, true);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_plan, '2026-07-02', 'dinner', 'cook', v_r2, 1);
end $$;

-- ---------------------------------------------------------------------------
-- First generation (app path, user A).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

-- 1
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplan')),
  'first regeneration succeeds');

set local role postgres;
-- 2
select is(
  (select count(*)::int from public.grocery_list_items where meal_plan_id = current_setting('test.gplan')::uuid),
  4, 'four identity-grouped rows generated (chicken, salt, oil, rice)');
-- 3: chicken combined across recipes and multipliers: 1*2 + 0.5*1 = 2.5
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken'),
  2.5::numeric, 'chicken aggregated across recipes (1x2 + 0.5x1 = 2.5)');
-- 4
select is(
  (select groceries_version from public.meal_plans where id = current_setting('test.gplan')::uuid),
  3, 'groceries_version stamped to the plan version (3)');
-- 5
select ok(
  (select bool_and(source_key !~ '^v[0-9]+\|') from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid),
  'identity keys carry no version prefix');

-- User state: check chicken, mark rice on-hand, override salt out of pantry.
set local role authenticated;
update public.grocery_list_items set is_checked = true
 where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken';
update public.grocery_list_items set is_on_hand = true
 where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'rice';
update public.grocery_list_items set is_pantry_staple = false
 where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'salt';

-- ---------------------------------------------------------------------------
-- Grocery-relevant change -> stale -> regeneration preserves state.
-- ---------------------------------------------------------------------------
-- 6: multiplier 2 -> 3 (M3 trigger bumps version 3 -> 4)
select lives_ok(
  format($$update public.meal_plan_items set serving_multiplier = 3 where id = %L::uuid$$,
         current_setting('test.gitem1')),
  'serving multiplier update succeeds');
set local role postgres;
-- 7
select ok(
  (select version is distinct from groceries_version from public.meal_plans
    where id = current_setting('test.gplan')::uuid),
  'M3 bump makes the list stale (version 4 vs groceries_version 3)');

set local role authenticated;
-- 8
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplan')),
  'regeneration after multiplier change succeeds');
set local role postgres;
-- 9: chicken now 1*3 + 0.5*1 = 3.5
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken'),
  3.5::numeric, 'chicken amount updated in place (3.5)');
-- 10
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken'),
  true, 'checked state preserved through the amount update');
-- 11
select is(
  (select is_on_hand from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'rice'),
  true, 'on-hand state preserved');
-- 12
select is(
  (select is_pantry_staple from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'salt'),
  false, 'manual pantry override preserved');
-- 13: salt 1*3 = 3
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'salt'),
  3::numeric, 'overridden row still gets its amount update (3)');

-- ---------------------------------------------------------------------------
-- Removals disappear; additions arrive unchecked.
-- ---------------------------------------------------------------------------
delete from public.ingredients
 where recipe_id = current_setting('test.r2')::uuid and lower(name) = 'rice';
set local role authenticated;
-- 14
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplan')),
  'regeneration after ingredient removal succeeds');
set local role postgres;
-- 15
select is(
  (select count(*)::int from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'rice'),
  0, 'removed ingredient disappears from the list');
-- 16
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken'),
  true, 'unrelated rows keep their state through a removal');

insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
values (current_setting('test.r1')::uuid, 'Pepper', 1, 'tsp', false);
set local role authenticated;
-- 17
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplan')),
  'regeneration after ingredient addition succeeds');
set local role postgres;
-- 18
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'pepper'),
  false, 'added ingredient arrives unchecked');

-- ---------------------------------------------------------------------------
-- Legacy 'v<n>|' rows are normalized and keep their state.
-- ---------------------------------------------------------------------------
update public.grocery_list_items
   set source_key = 'v99|' || source_key
 where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken';
set local role authenticated;
-- 19
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplan')),
  'regeneration over a legacy-prefixed row succeeds');
set local role postgres;
-- 20
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken'),
  true, 'legacy-prefixed row matched by identity and kept its state');
-- 21
select ok(
  (select source_key !~ '^v[0-9]+\|' from public.grocery_list_items
    where meal_plan_id = current_setting('test.gplan')::uuid and lower(ingredient_name) = 'chicken'),
  'legacy key normalized to the stable identity');

-- ---------------------------------------------------------------------------
-- RLS + empty plan.
-- ---------------------------------------------------------------------------
-- 22: user B cannot regenerate A's plan
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplan')),
  'P0001', null, 'another user cannot regenerate the owner''s plan');

-- 23/24/25: a plan with no cook items regenerates to an empty, stamped list
set local role postgres;
do $$
declare v uuid;
begin
  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-08', '2026-07-14')
  returning id into v;
  perform set_config('test.gplanz', v::text, true);
end $$;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.gplanz')),
  'regenerating a plan with no cook items succeeds');
set local role postgres;
select is(
  (select count(*)::int from public.grocery_list_items where meal_plan_id = current_setting('test.gplanz')::uuid),
  0, 'empty plan yields an empty list');
select is(
  (select groceries_version from public.meal_plans where id = current_setting('test.gplanz')::uuid),
  1, 'empty plan still gets its groceries_version stamped');

select * from finish();
rollback;
