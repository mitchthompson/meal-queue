-- supabase/tests/plan_integrity_test.sql
--
-- pgTAP coverage for Milestone 3 (Plan Integrity), migration
-- 20260702001350_plan_integrity.sql:
--   - trigger-based, GROCERY-SCOPED plan version bumps (cook items only;
--     note/leftover/eat-out edits must NOT advance the version),
--   - per-row bump accumulation (the concurrency-safe arithmetic form),
--   - cross-row validation: plan_date within range, same-owner recipes,
--     same-plan cook-sourced leftover links, protected cook items,
--     plan ranges that cannot shrink past items,
--   - tolerated legacy shape: orphan leftovers (NULL link) stay insertable,
--     survive re-edits, and are produced correctly by the delete-cook cascade,
--   - RI-cascade paths (recipe deletion, plan deletion), hostile-user
--     rejection, and slot-type transition bumps.
--
-- Same choreography as save_recipe_test.sql: one begin/rollback, superuser
-- (postgres) for fixtures and RLS-exempt verification reads, `authenticated`
-- + JWT claims for the app path, service_role for the RLS-bypass path.

begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser, RLS-exempt).
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'plan-user-a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'plan-user-b@test.local');

do $$
declare v_ra uuid; v_rb uuid; v_plan uuid;
begin
  insert into public.recipes (user_id, name, base_servings)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Curry', 2)
  returning id into v_ra;
  perform set_config('test.recipe_a', v_ra::text, true);

  insert into public.recipes (user_id, name, base_servings)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B Secret Stew', 2)
  returning id into v_rb;
  perform set_config('test.recipe_b', v_rb::text, true);

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-01', '2026-07-07')
  returning id into v_plan;
  perform set_config('test.plan1', v_plan::text, true);
end $$;

-- 1. baseline
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  1, 'plan version starts at 1');

-- ---------------------------------------------------------------------------
-- Scoped version bumps (app path, user A).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

-- 2/3. cook insert bumps
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
           values (%L::uuid, '2026-07-01', 'dinner', 'cook', %L::uuid, 1)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'cook item insert succeeds');

set local role postgres;
do $$
declare v uuid;
begin
  select id into v from public.meal_plan_items
   where meal_plan_id = current_setting('test.plan1')::uuid and slot_type = 'cook';
  perform set_config('test.cook1', v::text, true);
end $$;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  2, 'cook insert bumps version (1 -> 2)');

-- 4/5. eat-out insert does NOT bump
set local role authenticated;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, note)
           values (%L::uuid, '2026-07-02', 'dinner', 'eat_out', 'pizza night')$$,
         current_setting('test.plan1')),
  'eat_out item insert succeeds');

set local role postgres;
do $$
declare v uuid;
begin
  select id into v from public.meal_plan_items
   where meal_plan_id = current_setting('test.plan1')::uuid and slot_type = 'eat_out';
  perform set_config('test.eat1', v::text, true);
end $$;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  2, 'eat_out insert does NOT bump version');

-- 6/7. leftover insert (same plan, cook source) does NOT bump
set local role authenticated;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, leftover_from_item_id)
           values (%L::uuid, '2026-07-03', 'dinner', 'leftover', %L::uuid, %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a'), current_setting('test.cook1')),
  'leftover item insert succeeds');

set local role postgres;
do $$
declare v uuid;
begin
  select id into v from public.meal_plan_items
   where meal_plan_id = current_setting('test.plan1')::uuid
     and slot_type = 'leftover' and leftover_from_item_id is not null;
  perform set_config('test.left1', v::text, true);
end $$;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  2, 'leftover insert does NOT bump version');

-- 8/9. serving-multiplier change bumps
set local role authenticated;
select lives_ok(
  format($$update public.meal_plan_items set serving_multiplier = 2 where id = %L::uuid$$,
         current_setting('test.cook1')),
  'serving multiplier update succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  3, 'serving multiplier change bumps version (2 -> 3)');

-- 10/11. eat-out note edit does NOT bump
set local role authenticated;
select lives_ok(
  format($$update public.meal_plan_items set note = 'sushi night' where id = %L::uuid$$,
         current_setting('test.eat1')),
  'note update succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  3, 'note edit does NOT bump version');

-- 12/13. in-range date move of a cook item does NOT bump (groceries ignore dates)
set local role authenticated;
select lives_ok(
  format($$update public.meal_plan_items set plan_date = '2026-07-02' where id = %L::uuid$$,
         current_setting('test.cook1')),
  'in-range date move succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  3, 'in-range date move does NOT bump version');

-- ---------------------------------------------------------------------------
-- Validation rejections (app path, user A).
-- ---------------------------------------------------------------------------
set local role authenticated;

-- 14. plan_date outside range
select throws_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-31', 'dinner', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'P0001', null, 'plan_date outside the plan range is rejected');

-- 15. cross-owner recipe (B's recipe is invisible to A under RLS -> not found)
select throws_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-04', 'dinner', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_b')),
  'P0001', null, 'cross-owner recipe reference is rejected');

-- 16. leftover must reference a cooked item
select throws_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, leftover_from_item_id)
           values (%L::uuid, '2026-07-04', 'dinner', 'leftover', %L::uuid, %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a'), current_setting('test.eat1')),
  'P0001', null, 'leftover referencing a non-cook item is rejected');

-- 17. leftover must reference the SAME plan
set local role postgres;
do $$
declare v uuid;
begin
  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-08', '2026-07-14')
  returning id into v;
  perform set_config('test.plan2', v::text, true);
end $$;
set local role authenticated;
select throws_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, leftover_from_item_id)
           values (%L::uuid, '2026-07-08', 'dinner', 'leftover', %L::uuid, %L::uuid)$$,
         current_setting('test.plan2'), current_setting('test.recipe_a'), current_setting('test.cook1')),
  'P0001', null, 'cross-plan leftover link is rejected');

-- 18. a cook item referenced by leftovers cannot stop being a cook item
select throws_ok(
  format($$update public.meal_plan_items set slot_type = 'eat_out', recipe_id = null where id = %L::uuid$$,
         current_setting('test.cook1')),
  'P0001', null, 'referenced cook item cannot change slot_type');

-- 19. plan range cannot shrink past existing items
select throws_ok(
  format($$update public.meal_plans set end_date = '2026-07-01' where id = %L::uuid$$,
         current_setting('test.plan1')),
  'P0001', null, 'range shrink that strands items is rejected');

-- 20/21. widening is fine, and plan-meta changes never bump the version
select lives_ok(
  format($$update public.meal_plans set end_date = '2026-07-10' where id = %L::uuid$$,
         current_setting('test.plan1')),
  'range widen succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  3, 'plan meta change does NOT bump version');

-- ---------------------------------------------------------------------------
-- Legacy shape + deletes.
-- ---------------------------------------------------------------------------
set local role authenticated;

-- 22/23. orphan leftover (NULL link) stays insertable — matches live history
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-04', 'lunch', 'leftover', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'orphan leftover (NULL link) is allowed');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  3, 'orphan leftover insert does NOT bump version');

-- 24/25. leftover delete does NOT bump
set local role authenticated;
select lives_ok(
  format($$delete from public.meal_plan_items where id = %L::uuid$$,
         current_setting('test.left1')),
  'leftover delete succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  3, 'leftover delete does NOT bump version');

-- 26/27. cook delete bumps
set local role authenticated;
select lives_ok(
  format($$delete from public.meal_plan_items where id = %L::uuid$$,
         current_setting('test.cook1')),
  'cook delete succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  4, 'cook delete bumps version (3 -> 4)');

-- ---------------------------------------------------------------------------
-- Service-role path + per-row accumulation.
-- ---------------------------------------------------------------------------

-- 28/29. service-role insert (RLS bypass) still bumps
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-05', 'dinner', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'service-role cook insert succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  5, 'service-role cook insert bumps version (4 -> 5)');

-- 30/31. one statement inserting two cook rows bumps twice (accumulation, the
-- arithmetic form that makes concurrent increments lossless)
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-05', 'lunch',  'cook', %L::uuid),
                  (%L::uuid, '2026-07-06', 'dinner', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a'),
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'multi-row cook insert succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  7, 'two-row insert bumps twice (5 -> 7)');

-- 32/33. bulk delete (clear-slot analog) bumps once per cook row
set local role authenticated;
select lives_ok(
  format($$delete from public.meal_plan_items where meal_plan_id = %L::uuid and slot_type = 'cook'$$,
         current_setting('test.plan1')),
  'bulk cook delete succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  10, 'three-row bulk delete bumps three times (7 -> 10)');

-- ---------------------------------------------------------------------------
-- Cascades, transitions, hostile user, orphan re-touch (review coverage).
-- ---------------------------------------------------------------------------

-- 34/35. fresh cook item for the cascade tests
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-05', 'dinner', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'cascade-test cook item insert succeeds');
set local role postgres;
do $$
declare v uuid;
begin
  select id into v from public.meal_plan_items
   where meal_plan_id = current_setting('test.plan1')::uuid
     and slot_type = 'cook' and plan_date = '2026-07-05' and meal_type = 'dinner';
  perform set_config('test.cook3', v::text, true);
end $$;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  11, 'cascade-test cook insert bumps (10 -> 11)');

-- 36. live leftover dependent on the new cook item
set local role authenticated;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, leftover_from_item_id)
           values (%L::uuid, '2026-07-06', 'dinner', 'leftover', %L::uuid, %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a'), current_setting('test.cook3')),
  'dependent leftover insert succeeds');
set local role postgres;
do $$
declare v uuid;
begin
  select id into v from public.meal_plan_items
   where meal_plan_id = current_setting('test.plan1')::uuid
     and slot_type = 'leftover' and plan_date = '2026-07-06';
  perform set_config('test.left2', v::text, true);
end $$;

-- 37. a referenced cook item cannot MOVE to another plan either
set local role authenticated;
select throws_ok(
  format($$update public.meal_plan_items set meal_plan_id = %L::uuid, plan_date = '2026-07-08' where id = %L::uuid$$,
         current_setting('test.plan2'), current_setting('test.cook3')),
  'P0001', null, 'referenced cook item cannot move to another plan');

-- 38/39/40. deleting a cook item with a LIVE dependent: the FK cascade nulls
-- the dependent's link (re-firing validation on it), the delete bumps once,
-- and the dependent becomes a valid orphan.
select lives_ok(
  format($$delete from public.meal_plan_items where id = %L::uuid$$,
         current_setting('test.cook3')),
  'deleting a cook item with a live leftover dependent succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  12, 'cook delete with live dependent bumps once (11 -> 12)');
select is(
  (select leftover_from_item_id is null and slot_type = 'leftover'
     from public.meal_plan_items where id = current_setting('test.left2')::uuid),
  true, 'dependent leftover became a valid orphan (link nulled by cascade)');

-- 41/42. orphan re-touch: editing the orphan passes validation, no bump
set local role authenticated;
select lives_ok(
  format($$update public.meal_plan_items set note = 'orphan re-touch' where id = %L::uuid$$,
         current_setting('test.left2')),
  'editing an orphan leftover passes validation');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  12, 'orphan re-touch does NOT bump version');

-- 43/44/45. unreferenced cook -> eat_out transition bumps via the OLD side
set local role authenticated;
select lives_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-06', 'lunch', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_a')),
  'transition-test cook insert succeeds');
set local role postgres;
do $$
declare v uuid;
begin
  select id into v from public.meal_plan_items
   where meal_plan_id = current_setting('test.plan1')::uuid
     and slot_type = 'cook' and plan_date = '2026-07-06' and meal_type = 'lunch';
  perform set_config('test.cook4', v::text, true);
end $$;
set local role authenticated;
select lives_ok(
  format($$update public.meal_plan_items set slot_type = 'eat_out', recipe_id = null where id = %L::uuid$$,
         current_setting('test.cook4')),
  'unreferenced cook -> eat_out transition succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan1')::uuid),
  14, 'cook insert then cook->eat_out transition each bump (12 -> 14)');

-- 46. hostile user: B cannot insert into A's plan (invisible under RLS)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  format($$insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
           values (%L::uuid, '2026-07-05', 'lunch', 'cook', %L::uuid)$$,
         current_setting('test.plan1'), current_setting('test.recipe_b')),
  'P0001', null, 'hostile user cannot insert into another owner''s plan');

-- 47/48. recipe deletion cascade: cascading cook-item deletes bump the plan
set local role postgres;
do $$
declare v_rc uuid; v_p3 uuid;
begin
  insert into public.recipes (user_id, name, base_servings)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Doomed Recipe', 2)
  returning id into v_rc;
  perform set_config('test.recipe_c', v_rc::text, true);

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-15', '2026-07-21')
  returning id into v_p3;
  perform set_config('test.plan3', v_p3::text, true);

  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  values (v_p3, '2026-07-15', 'dinner', 'cook', v_rc);  -- bumps plan3 to 2
end $$;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format($$delete from public.recipes where id = %L::uuid$$,
         current_setting('test.recipe_c')),
  'recipe deletion (cascading its cook items) succeeds');
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan3')::uuid),
  3, 'recipe-deletion cascade bumps the referencing plan (2 -> 3)');

-- 49/50. plan deletion cascade: items cascade away; the bump trigger firing
-- against the already-deleted plan row is harmless.
do $$
declare v_p4 uuid;
begin
  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-22', '2026-07-28')
  returning id into v_p4;
  perform set_config('test.plan4', v_p4::text, true);

  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  values (v_p4, '2026-07-22', 'dinner', 'cook', current_setting('test.recipe_a')::uuid);
end $$;
set local role authenticated;
select lives_ok(
  format($$delete from public.meal_plans where id = %L::uuid$$,
         current_setting('test.plan4')),
  'plan deletion with live cook items succeeds (cascade + bump vs deleted row)');
set local role postgres;
select is(
  (select count(*)::int from public.meal_plan_items
    where meal_plan_id = current_setting('test.plan4')::uuid),
  0, 'plan deletion cascaded all its items away');

select * from finish();
rollback;
