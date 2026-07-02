-- supabase/tests/save_recipe_test.sql
--
-- pgTAP coverage for public.save_recipe (Milestone 2 - Atomic Recipe Saves).
-- Run by `supabase test db` against the EPHEMERAL local stack. The full schema
-- (supabase/migrations/20260101000000_baseline_schema.sql, a copy of
-- supabase/schema.sql) and the function-under-test migration
-- (20260627222320_atomic_recipe_save.sql) are already applied by
-- `supabase start` / `supabase db reset` before this file runs. This whole file
-- runs inside one begin/rollback, so it leaves no residue.
--
-- Auth-context model: save_recipe is SECURITY INVOKER, so RLS applies under the
-- `authenticated` role. We seed auth.users, then for the app path switch to
-- `authenticated` and set the JWT sub claim (both request.jwt.claim.sub and the
-- request.jwt.claims JSON, so auth.uid() resolves regardless of CLI version).
-- We hop back to `postgres` (superuser, RLS-exempt) for cross-user setup and for
-- verification reads that must not be filtered by RLS.
--
-- NOTE on role/claim switching: per the official Supabase pgTAP examples, the
-- `set local role ...` and JWT-claim `set_config(...)` calls are done at the
-- TOP LEVEL of this transaction (NOT inside a helper function). A SET LOCAL
-- issued at transaction scope persists until changed or the transaction ends,
-- which is exactly what we want; doing it inline avoids any dependence on
-- PostgreSQL's per-function GUC save/restore rules.

begin;

-- pgTAP lives in the `extensions` schema on Supabase. Install it (the CLI
-- already does this, so this is a redundant no-op via `supabase test db`) and
-- make its functions visible BEFORE the first plan()/lives_ok() call so the
-- file is also self-sufficient under raw psql.
create extension if not exists pgtap with schema extensions;

select plan(33);

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser, RLS-exempt).
-- ---------------------------------------------------------------------------
set local role postgres;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-b@test.local');

-- =====================================================================
-- 1. HAPPY-PATH INSERT (app path, user A, p_recipe_id => null)
--    - returns a uuid
--    - ingredients/steps/tags rows exist
--    - tags normalized + deduped
--    - steps renumbered 1..N with blanks dropped
--    - blank-name ingredients dropped
-- =====================================================================

-- Act as user A on the app path: limited `authenticated` role plus both
-- JWT-claim shapes that auth.uid() may read.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$select public.save_recipe(
      null,
      'Tomato Soup',
      4,
      '  blend it  ',
      '[{"name":"tomato","amount":3,"unit_code":"item","is_pantry_staple":false},
        {"name":"  ","amount":1,"unit_code":"cup","is_pantry_staple":false},
        {"name":"salt","amount":1,"unit_code":"tsp","is_pantry_staple":true}]'::jsonb,
      '["Chop","   ","Simmer","Blend"]'::jsonb,
      '["Soup"," soup ","Dinner","DINNER"]'::jsonb
    )$$,
  'happy path: save_recipe(null, ...) succeeds'
);

-- Grab the recipe id we just created (as owner; RLS lets the owner read it).
set local role postgres;
do $$
declare v_id uuid;
begin
  select id into v_id from public.recipes where name = 'Tomato Soup';
  perform set_config('test.recipe_id', v_id::text, true);
end;
$$;

select isnt(current_setting('test.recipe_id'), '', 'insert returned/persisted a recipe row');

-- returns uuid type check: the function signature returns uuid (compile-time),
-- and we confirm a uuid is actually stored.
select ok(
  (select id is not null from public.recipes where name = 'Tomato Soup'),
  'recipe id is a non-null uuid'
);

-- blank-name ingredient dropped -> 2 ingredients (tomato, salt)
select is(
  (select count(*)::int from public.ingredients
     where recipe_id = current_setting('test.recipe_id')::uuid),
  2,
  'blank-name ingredient dropped (2 ingredients kept)'
);

select bag_eq(
  $$select name from public.ingredients
      where recipe_id = current_setting('test.recipe_id')::uuid$$,
  $$values ('tomato'), ('salt')$$,
  'kept ingredient names are exactly tomato + salt'
);

-- steps: blank dropped, renumbered 1..3 contiguously in input order
select is(
  (select count(*)::int from public.recipe_steps
     where recipe_id = current_setting('test.recipe_id')::uuid),
  3,
  'blank step dropped (3 steps kept)'
);

select results_eq(
  $$select step_number, body from public.recipe_steps
      where recipe_id = current_setting('test.recipe_id')::uuid
      order by step_number$$,
  $$values (1,'Chop'), (2,'Simmer'), (3,'Blend')$$,
  'steps renumbered 1..N contiguously with blanks removed, input order preserved'
);

-- tags normalized (lowercased/trimmed) + deduped -> {soup, dinner}
select is(
  (select count(*)::int from public.recipe_tags
     where recipe_id = current_setting('test.recipe_id')::uuid),
  2,
  'tags deduped to 2 links'
);

select bag_eq(
  $$select t.name from public.recipe_tags rt
      join public.tags t on t.id = rt.tag_id
      where rt.recipe_id = current_setting('test.recipe_id')::uuid$$,
  $$values ('soup'), ('dinner')$$,
  'tags normalized to lowercase/trimmed and deduped (soup, dinner)'
);

-- parent fields normalized: name trimmed, instructions trimmed, base_servings kept.
-- base_servings is stored as numeric(6,2) -> 4.00; cast the column to plain
-- numeric in the SELECT so both sides share representation (avoids relying on
-- cross-scale numeric equality inside a record comparison).
select results_eq(
  $$select name, base_servings::numeric, instructions_raw from public.recipes
      where id = current_setting('test.recipe_id')::uuid$$,
  $$values ('Tomato Soup', 4::numeric, 'blend it')$$,
  'parent fields normalized (name/instructions trimmed, base_servings stored)'
);

-- =====================================================================
-- 2. UPDATE PATH replaces children wholesale
-- =====================================================================
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  format(
    $$select public.save_recipe(
        %L::uuid,
        'Tomato Soup v2',
        2,
        'new instructions',
        '[{"name":"basil","amount":2,"unit_code":"tbsp","is_pantry_staple":false}]'::jsonb,
        '["Only step"]'::jsonb,
        '["fresh"]'::jsonb
      )$$,
    current_setting('test.recipe_id')
  ),
  'update path: re-saving an existing recipe succeeds'
);

set local role postgres;

select bag_eq(
  $$select name from public.ingredients
      where recipe_id = current_setting('test.recipe_id')::uuid$$,
  $$values ('basil')$$,
  'update replaces ingredients wholesale (old tomato/salt gone, only basil)'
);

select results_eq(
  $$select step_number, body from public.recipe_steps
      where recipe_id = current_setting('test.recipe_id')::uuid
      order by step_number$$,
  $$values (1,'Only step')$$,
  'update replaces steps wholesale'
);

select bag_eq(
  $$select t.name from public.recipe_tags rt
      join public.tags t on t.id = rt.tag_id
      where rt.recipe_id = current_setting('test.recipe_id')::uuid$$,
  $$values ('fresh')$$,
  'update replaces tag links wholesale'
);

select is(
  (select name from public.recipes where id = current_setting('test.recipe_id')::uuid),
  'Tomato Soup v2',
  'update path updated the parent name'
);

-- =====================================================================
-- 3. ATOMICITY ROLLBACK
--    A save with an invalid child (bad unit_code FK) THROWS and leaves the
--    recipe + its children UNCHANGED. The function has no internal EXCEPTION
--    handler, so the failing SELECT save_recipe(...) statement aborts as a
--    unit -> Postgres rolls back ALL of its effects (the deletes + partial
--    child inserts) atomically. throws_ok catches the error so the outer
--    pgTAP transaction survives, then we assert nothing changed.
-- =====================================================================
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

-- bad unit_code -> FK violation on ingredients.unit_code -> units(code)
select throws_ok(
  format(
    $$select public.save_recipe(
        %L::uuid,
        'Tomato Soup v2',
        2,
        'new instructions',
        '[{"name":"basil","amount":2,"unit_code":"NOPE","is_pantry_staple":false}]'::jsonb,
        '["Only step"]'::jsonb,
        '["fresh"]'::jsonb
      )$$,
    current_setting('test.recipe_id')
  ),
  '23503',  -- foreign_key_violation
  null,
  'bad unit_code FK raises foreign_key_violation'
);

-- negative amount -> check (amount >= 0) violation, also aborts the save
select throws_ok(
  format(
    $$select public.save_recipe(
        %L::uuid,
        'Tomato Soup v2',
        2,
        'new instructions',
        '[{"name":"basil","amount":-5,"unit_code":"tbsp","is_pantry_staple":false}]'::jsonb,
        '["Only step"]'::jsonb,
        '["fresh"]'::jsonb
      )$$,
    current_setting('test.recipe_id')
  ),
  '23514',  -- check_violation (amount >= 0)
  null,
  'negative amount raises check_violation'
);

set local role postgres;

-- Children are exactly what the successful update (test 2) left behind.
select bag_eq(
  $$select name from public.ingredients
      where recipe_id = current_setting('test.recipe_id')::uuid$$,
  $$values ('basil')$$,
  'atomic rollback: ingredients unchanged after both failed saves'
);

select results_eq(
  $$select step_number, body from public.recipe_steps
      where recipe_id = current_setting('test.recipe_id')::uuid
      order by step_number$$,
  $$values (1,'Only step')$$,
  'atomic rollback: steps unchanged after failed saves'
);

select is(
  (select name from public.recipes where id = current_setting('test.recipe_id')::uuid),
  'Tomato Soup v2',
  'atomic rollback: parent name unchanged after failed saves'
);

-- =====================================================================
-- 4. VERSION BUMP on grocery-relevant change; NO-OP resave does not bump.
-- =====================================================================
set local role postgres;
do $$
declare v_plan uuid;
begin
  insert into public.meal_plans (user_id, start_date, end_date)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-01', '2026-07-07')
  returning id into v_plan;
  perform set_config('test.plan_id', v_plan::text, true);

  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_plan, '2026-07-01', 'dinner', 'cook', current_setting('test.recipe_id')::uuid, 1);
end;
$$;

-- current version baseline. The plan_integrity trigger (milestone 3) bumps on
-- the cook-item fixture insert above, so the plan starts at 2 here.
select is(
  (select version from public.meal_plans where id = current_setting('test.plan_id')::uuid),
  2,
  'plan version is 2 after the cook-item fixture (trigger bump)'
);

-- changing an ingredient amount is a grocery-relevant change -> bump
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format(
    $$select public.save_recipe(
        %L::uuid, 'Tomato Soup v2', 2, 'new instructions',
        '[{"name":"basil","amount":9,"unit_code":"tbsp","is_pantry_staple":false}]'::jsonb,
        '["Only step"]'::jsonb, '["fresh"]'::jsonb)$$,
    current_setting('test.recipe_id')
  ),
  'resave with changed ingredient amount succeeds'
);
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan_id')::uuid),
  3,
  'changing an ingredient amount bumps the referencing plan version (2 -> 3)'
);

-- NO-OP resave: identical ingredient set -> NO bump
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok(
  format(
    $$select public.save_recipe(
        %L::uuid, 'Tomato Soup v2', 2, 'new instructions',
        '[{"name":"basil","amount":9,"unit_code":"tbsp","is_pantry_staple":false}]'::jsonb,
        '["Only step"]'::jsonb, '["fresh"]'::jsonb)$$,
    current_setting('test.recipe_id')
  ),
  'no-op resave (identical ingredients) succeeds'
);
set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.plan_id')::uuid),
  3,
  'no-op resave does NOT bump the plan version (stays 3)'
);

-- =====================================================================
-- 5. OWNER-SCOPE + RLS
--    - user A cannot save user B's recipe id -> 'not found or not owned'
--    - version bump touches only the owner's plans
--    - service-role / p_user_id branch works
-- =====================================================================

-- Seed a recipe owned by B (as superuser), plus a B-owned plan referencing it.
set local role postgres;
do $$
declare v_b_recipe uuid; v_b_plan uuid;
begin
  insert into public.recipes (user_id, name, base_servings)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B Stew', 2)
  returning id into v_b_recipe;
  perform set_config('test.b_recipe_id', v_b_recipe::text, true);

  insert into public.ingredients (recipe_id, name, amount, unit_code)
  values (v_b_recipe, 'beef', 1, 'lb');

  insert into public.meal_plans (user_id, start_date, end_date)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-07-01', '2026-07-07')
  returning id into v_b_plan;
  perform set_config('test.b_plan_id', v_b_plan::text, true);

  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
  values (v_b_plan, '2026-07-01', 'dinner', 'cook', v_b_recipe, 1);
end;
$$;

-- As user A, try to save B's recipe id: UPDATE ... where user_id = A matches no
-- row, so the function raises 'not found or not owned'.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.save_recipe(
        %L::uuid, 'Hijacked', 2, null,
        '[{"name":"beef","amount":2,"unit_code":"lb","is_pantry_staple":false}]'::jsonb,
        '[]'::jsonb, '[]'::jsonb)$$,
    current_setting('test.b_recipe_id')
  ),
  'P0001',  -- raise_exception
  'save_recipe: recipe ' || current_setting('test.b_recipe_id') || ' not found or not owned by the caller',
  'user A saving user B''s recipe raises not-found-or-not-owned'
);

set local role postgres;
select is(
  (select name from public.recipes where id = current_setting('test.b_recipe_id')::uuid),
  'B Stew',
  'B''s recipe is unchanged after A''s rejected save'
);
select is(
  (select version from public.meal_plans where id = current_setting('test.b_plan_id')::uuid),
  2,
  'B''s plan version (2 after its cook fixture) untouched by A''s rejected save'
);

-- Service-role / p_user_id branch: no JWT sub, pass p_user_id = B. This is the
-- documented RLS-bypass MCP path. It should create a recipe owned by B and bump
-- only B's referencing plans.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;
select lives_ok(
  $$select public.save_recipe(
      null, 'Service Recipe', 3, null,
      '[{"name":"carrot","amount":2,"unit_code":"item","is_pantry_staple":false}]'::jsonb,
      '["step one"]'::jsonb, '["svc"]'::jsonb,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)$$,
  'service-role path: save_recipe with p_user_id creates a recipe'
);

set local role postgres;
select is(
  (select user_id from public.recipes where name = 'Service Recipe'),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'service-role path: created recipe is owned by the supplied p_user_id (B)'
);

-- Attach B's plan to the service-created recipe, then change ingredients via the
-- service path and confirm ONLY B's plan bumps.
do $$
declare v_svc uuid;
begin
  select id into v_svc from public.recipes where name = 'Service Recipe';
  perform set_config('test.svc_recipe_id', v_svc::text, true);
  update public.meal_plan_items
     set recipe_id = v_svc
   where meal_plan_id = current_setting('test.b_plan_id')::uuid;
  -- reset B's plan version to a known value for a clean assertion
  update public.meal_plans set version = 5 where id = current_setting('test.b_plan_id')::uuid;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;
select lives_ok(
  format(
    $$select public.save_recipe(
        %L::uuid, 'Service Recipe', 3, null,
        '[{"name":"carrot","amount":99,"unit_code":"item","is_pantry_staple":false}]'::jsonb,
        '["step one"]'::jsonb, '["svc"]'::jsonb,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)$$,
    current_setting('test.svc_recipe_id')
  ),
  'service-role path: update with changed ingredient succeeds'
);

set local role postgres;
select is(
  (select version from public.meal_plans where id = current_setting('test.b_plan_id')::uuid),
  6,
  'service-role path: owner-scoped version bump touched B''s plan (5 -> 6)'
);
select is(
  (select version from public.meal_plans where id = current_setting('test.plan_id')::uuid),
  3,
  'service-role path: A''s unrelated plan untouched (stays 3)'
);

select * from finish();
rollback;
