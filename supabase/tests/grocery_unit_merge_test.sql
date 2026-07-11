-- supabase/tests/grocery_unit_merge_test.sql
--
-- pgTAP coverage for Milestone 12 (Grocery unit merge), migration
-- 20260711225000_grocery_unit_merge.sql:
--   - dimension-aware buckets: volume merges with volume, weight with weight,
--     displayed in the largest contributing unit at 3-decimal precision,
--   - count units (item/clove/slice) never merge across codes,
--   - pantry classification still separates buckets,
--   - serving multipliers scale before conversion,
--   - user state survives the identity change: stable keys keep their checked
--     state; OLD-key rows (name|unit_code|flag) are migrated in place, and
--     rows that collapse into one bucket merge state with bool_and,
--   - the display unit_code updates in place when a larger unit joins a
--     bucket,
--   - regeneration is idempotent (second run changes nothing),
--   - units.base_factor is populated for the full 13-code vocabulary.
--
-- House choreography: one begin/rollback; postgres for fixtures + verification
-- reads; `authenticated` + JWT claims for the app path.

begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser).
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (id, email) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'unit-merge@test.local');

do $$
declare
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_r5 uuid; v_r6 uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid;
begin
  -- P1 recipes: the core merge matrix (each ingredient name is one case).
  insert into public.recipes (user_id, name, base_servings)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Merge Matrix A', 2)
  returning id into v_r1;
  perform set_config('test.r1', v_r1::text, true);
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (v_r1, 'Broth',  1, 'cup',  false),  -- case 1: cup + tbsp
    (v_r1, 'Beef',   1, 'lb',   false),  -- case 2: lb + oz
    (v_r1, 'Stock',  1, 'cup',  false),  -- case 3: cup + ml
    (v_r1, 'Salt',   2, 'tsp',  false),  -- case 5: same unit
    (v_r1, 'Garlic', 2, 'item', false),  -- case 4: count codes never merge
    (v_r1, 'Sugar',  1, 'tsp',  true);   -- case 6: pantry flag separates

  insert into public.recipes (user_id, name, base_servings)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Merge Matrix B', 2)
  returning id into v_r2;
  perform set_config('test.r2', v_r2::text, true);
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (v_r2, 'broth',    8, 'tbsp',  false),
    (v_r2, 'beef',     4, 'oz',    false),
    (v_r2, 'stock',  240, 'ml',    false),
    (v_r2, 'salt',     1, 'tsp',   false),
    (v_r2, 'garlic',   3, 'clove', false),
    (v_r2, 'sugar',    1, 'tsp',   false);

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-07-13', '2026-07-19')
  returning id into v_p1;
  perform set_config('test.p1', v_p1::text, true);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_p1, '2026-07-13', 'dinner', 'cook', v_r1, 1),
         (v_p1, '2026-07-14', 'dinner', 'cook', v_r2, 1);

  -- P2: serving multiplier scales before conversion (case 10).
  insert into public.recipes (user_id, name, base_servings)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Multiplier A', 2)
  returning id into v_r3;
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
  values (v_r3, 'Cream', 1, 'cup', false);
  insert into public.recipes (user_id, name, base_servings)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Multiplier B', 2)
  returning id into v_r4;
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
  values (v_r4, 'cream', 4, 'tbsp', false);

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-07-20', '2026-07-26')
  returning id into v_p2;
  perform set_config('test.p2', v_p2::text, true);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_p2, '2026-07-20', 'dinner', 'cook', v_r3, 1.5),
         (v_p2, '2026-07-21', 'dinner', 'cook', v_r4, 1);

  -- P3 / P4: OLD-key rows seeded pre-regeneration (cases 8 and 9).
  insert into public.recipes (user_id, name, base_servings)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gravy A', 2)
  returning id into v_r5;
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
  values (v_r5, 'Gravy', 1, 'cup', false);
  insert into public.recipes (user_id, name, base_servings)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gravy B', 2)
  returning id into v_r6;
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
  values (v_r6, 'gravy', 240, 'ml', false);

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-07-27', '2026-08-02')
  returning id into v_p3;
  perform set_config('test.p3', v_p3::text, true);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_p3, '2026-07-27', 'dinner', 'cook', v_r5, 1),
         (v_p3, '2026-07-28', 'dinner', 'cook', v_r6, 1);
  -- Case 8 seed: mixed state -> bool_and must land false.
  insert into public.grocery_list_items
    (meal_plan_id, ingredient_name, amount, unit_code, is_pantry_staple, is_checked, is_on_hand, source_key)
  values
    (v_p3, 'Gravy',   1, 'cup', false, true,  false, 'gravy|cup|0'),
    (v_p3, 'gravy', 240, 'ml',  false, false, false, 'gravy|ml|0');

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-08-03', '2026-08-09')
  returning id into v_p4;
  perform set_config('test.p4', v_p4::text, true);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_p4, '2026-08-03', 'dinner', 'cook', v_r5, 1),
         (v_p4, '2026-08-04', 'dinner', 'cook', v_r6, 1);
  -- Case 9 seed: every part checked AND on hand -> bool_and keeps both true.
  insert into public.grocery_list_items
    (meal_plan_id, ingredient_name, amount, unit_code, is_pantry_staple, is_checked, is_on_hand, source_key)
  values
    (v_p4, 'Gravy',   1, 'cup', false, true, true, 'gravy|cup|0'),
    (v_p4, 'gravy', 240, 'ml',  false, true, true, 'gravy|ml|0');
end $$;

-- ---------------------------------------------------------------------------
-- Core merge matrix (app path, plan P1).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('request.jwt.claims', json_build_object('sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'role', 'authenticated')::text, true);
set local role authenticated;

-- 1
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.p1')),
  'regeneration with dimension merging succeeds');

set local role postgres;
-- 2/3/4: case 1 — 1 cup + 8 tbsp = 1.5 cup, keyed on the dimension
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'broth'),
  1.500::numeric, 'cup + tbsp merge to one row (1.500)');
select is(
  (select unit_code from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'broth'),
  'cup', 'merged volume row displays the largest contributing unit (cup)');
select is(
  (select source_key from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'broth'),
  'broth|vol|0', 'volume identity keys on the dimension (broth|vol|0)');
-- 5/6: case 2 — 1 lb + 4 oz = 1.25 lb
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'beef'),
  1.250::numeric, 'lb + oz merge to one row (1.250)');
select is(
  (select unit_code from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'beef'),
  'lb', 'merged weight row displays the largest contributing unit (lb)');
-- 7/8: case 3 — 1 cup + 240 ml = 2.014 cup
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'stock'),
  2.014::numeric, 'cup + ml merge across unit systems (2.014)');
select is(
  (select unit_code from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'stock'),
  'cup', 'cross-system merge displays in the larger unit (cup)');
-- 9/10/11: case 4 — count codes never merge
select is(
  (select count(*)::int from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'garlic'),
  2, 'item and clove stay two rows (count codes never merge)');
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid
      and lower(ingredient_name) = 'garlic' and unit_code = 'item'),
  2.000::numeric, 'item bucket sums only item amounts (2)');
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid
      and lower(ingredient_name) = 'garlic' and unit_code = 'clove'),
  3.000::numeric, 'clove bucket sums only clove amounts (3)');
-- 12/13: case 5 — same-unit bucket keeps its unit
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'salt'),
  3.000::numeric, 'same-unit amounts still sum plainly (3 tsp)');
select is(
  (select unit_code from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'salt'),
  'tsp', 'same-unit bucket keeps its unit (largest of one)');
-- 14: case 6 — pantry classification still separates buckets
select is(
  (select count(*)::int from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'sugar'),
  2, 'pantry vs non-pantry sugar stay two rows');
-- 15: conversion data present for the whole vocabulary
select is(
  (select count(*)::int from public.units where base_factor is not null),
  13, 'base_factor populated for all 13 unit codes');

-- ---------------------------------------------------------------------------
-- Case 10: serving multiplier scales before conversion (plan P2).
-- ---------------------------------------------------------------------------
set local role authenticated;
-- 16
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.p2')),
  'regeneration with multipliers succeeds');
set local role postgres;
-- 17/18: 1 cup x 1.5 + 4 tbsp x 1 = 1.75 cup
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p2')::uuid and lower(ingredient_name) = 'cream'),
  1.750::numeric, 'multiplier applies before conversion (1.750)');
select is(
  (select unit_code from public.grocery_list_items
    where meal_plan_id = current_setting('test.p2')::uuid and lower(ingredient_name) = 'cream'),
  'cup', 'multiplied bucket displays in the largest unit (cup)');

-- ---------------------------------------------------------------------------
-- Case 7: checked state is stable under the new identity (plan P1).
-- ---------------------------------------------------------------------------
set local role authenticated;
update public.grocery_list_items set is_checked = true
 where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'broth';
set local role postgres;
insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
values (current_setting('test.r2')::uuid, 'Broth', 1, 'tsp', false);
set local role authenticated;
-- 19
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.p1')),
  'regeneration after adding a same-dimension ingredient succeeds');
set local role postgres;
-- 20
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'broth'),
  true, 'checked state survives (identity stable under the dimension key)');
-- 21: 1.5 cup + 1 tsp = 1.521 cup
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'broth'),
  1.521::numeric, 'amount updated in place on the checked row (1.521)');

-- ---------------------------------------------------------------------------
-- Display unit upgrades in place when a larger unit joins the bucket.
-- ---------------------------------------------------------------------------
insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple)
values (current_setting('test.r2')::uuid, 'Salt', 1, 'cup', false);
set local role authenticated;
-- 22
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.p1')),
  'regeneration after a larger unit joins succeeds');
set local role postgres;
-- 23/24/25: 3 tsp + 1 cup = 1.063 cup, same single row
select is(
  (select unit_code from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'salt'),
  'cup', 'display unit_code upgrades in place (tsp -> cup)');
select is(
  (select amount::numeric from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'salt'),
  1.063::numeric, 'upgraded bucket amount converts correctly (1.063)');
select is(
  (select count(*)::int from public.grocery_list_items
    where meal_plan_id = current_setting('test.p1')::uuid and lower(ingredient_name) = 'salt'),
  1, 'unit upgrade does not split the bucket');

-- ---------------------------------------------------------------------------
-- Cases 8/9: OLD-key rows migrate in place with bool_and state.
-- ---------------------------------------------------------------------------
set local role authenticated;
-- 26
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.p3')),
  'regeneration over old-key rows succeeds');
set local role postgres;
-- 27/28/29
select is(
  (select count(*)::int from public.grocery_list_items
    where meal_plan_id = current_setting('test.p3')::uuid and lower(ingredient_name) = 'gravy'),
  1, 'old cup and ml rows collapse to one bucket');
select is(
  (select source_key from public.grocery_list_items
    where meal_plan_id = current_setting('test.p3')::uuid and lower(ingredient_name) = 'gravy'),
  'gravy|vol|0', 'survivor carries the migrated dimension key');
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.p3')::uuid and lower(ingredient_name) = 'gravy'),
  false, 'mixed state merges conservatively (bool_and -> unchecked)');

set local role authenticated;
-- 30
select lives_ok(
  format($$select public.regenerate_grocery_list(%L::uuid)$$, current_setting('test.p4')),
  'regeneration over fully-checked old-key rows succeeds');
set local role postgres;
-- 31/32
select is(
  (select is_checked from public.grocery_list_items
    where meal_plan_id = current_setting('test.p4')::uuid and lower(ingredient_name) = 'gravy'),
  true, 'all-checked parts stay checked through the merge');
select is(
  (select is_on_hand from public.grocery_list_items
    where meal_plan_id = current_setting('test.p4')::uuid and lower(ingredient_name) = 'gravy'),
  true, 'all-on-hand parts stay on hand through the merge');

-- ---------------------------------------------------------------------------
-- Case 11: regeneration is idempotent.
-- ---------------------------------------------------------------------------
select set_config('test.snap', (
  select string_agg(
           source_key || '~' || amount::text || '~' || unit_code || '~'
             || is_checked::text || '~' || is_on_hand::text || '~' || is_pantry_staple::text,
           ';' order by source_key)
  from public.grocery_list_items
  where meal_plan_id = current_setting('test.p1')::uuid), true);
set local role authenticated;
select public.regenerate_grocery_list(current_setting('test.p1')::uuid);
set local role postgres;
-- 33
select is(
  (select string_agg(
            source_key || '~' || amount::text || '~' || unit_code || '~'
              || is_checked::text || '~' || is_on_hand::text || '~' || is_pantry_staple::text,
            ';' order by source_key)
     from public.grocery_list_items
     where meal_plan_id = current_setting('test.p1')::uuid),
  current_setting('test.snap'),
  'a second regeneration is row-for-row identical (keys, amounts, units, state)');

select * from finish();
rollback;
