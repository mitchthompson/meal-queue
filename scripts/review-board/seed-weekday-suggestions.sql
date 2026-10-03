-- Milestone 17 (weekday suggestions) board and harness seed. LOCAL stack only,
-- never prod. Owner: wsverify@local.test (the scripts sign it up on first run).
-- Idempotent: wipes that user's plans and recipes first. Dates assume the
-- scripts pin the browser clock to Wed 2026-09-30, so the habit window is
-- 2026-06-10 .. 2026-09-29. Columns confirmed against supabase/schema.sql.
do $$
declare
  v_user uuid;
  r_chicken uuid; r_salmon uuid; r_cod uuid; r_beans uuid; r_tacos uuid;
  r_pasta uuid; r_soup uuid; r_stew uuid; r_stirfry uuid;
  v_hist uuid; v_t1 uuid; v_t2 uuid;
begin
  select id into v_user from auth.users where email = 'wsverify@local.test';
  if v_user is null then
    raise exception 'wsverify@local.test missing (run the sign-in phase first)';
  end if;
  delete from public.meal_plans where user_id = v_user;
  delete from public.recipes where user_id = v_user;

  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Crispy Chicken Thighs', 4) returning id into r_chicken;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Sheet-Pan Salmon', 2) returning id into r_salmon;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Baked Cod', 2) returning id into r_cod;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Hurst 15-Bean Soup', 6) returning id into r_beans;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Weeknight Tacos', 4) returning id into r_tacos;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Caprese Pasta', 2) returning id into r_pasta;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Chicken Noodle Soup', 4) returning id into r_soup;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Beef Stew', 6) returning id into r_stew;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Veggie Stir-Fry', 2) returning id into r_stirfry;
  insert into public.recipes (user_id, name, base_servings) values
    (v_user, 'Greek Salad', 2), (v_user, 'Lentil Curry', 4), (v_user, 'Mushroom Risotto', 4);

  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (r_stirfry, 'ws bell pepper', 2, 'item', false),
    (r_stirfry, 'ws snap peas', 8, 'oz', false),
    (r_chicken, 'ws chicken thighs', 2, 'lb', false),
    (r_salmon, 'ws salmon fillet', 1, 'lb', false),
    (r_beans, 'ws bean soup mix', 20, 'oz', false),
    (r_tacos, 'ws tortillas', 8, 'item', false);

  -- History: one long past plan ending the day before the pinned today.
  insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, date '2026-05-15', date '2026-09-29') returning id into v_hist;

  -- Thu: chicken on all of the last 8 Thursdays (habit, 8 of 8).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_chicken
  from unnest(array['2026-09-24','2026-09-17','2026-09-10','2026-09-03','2026-08-27','2026-08-20','2026-08-13','2026-08-06']::date[]) as t(d);

  -- Fri: cod and salmon alternate, 4 each (both habits; salmon ranks first because cod was cooked last).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_cod
  from unnest(array['2026-09-25','2026-09-11','2026-08-28','2026-08-14']::date[]) as t(d);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_salmon
  from unnest(array['2026-09-18','2026-09-04','2026-08-21','2026-08-07']::date[]) as t(d);

  -- Sun: beans on 3 of the last 8 (habit at the bar); eat-out on the other 5;
  -- pasta 3 times, but only on older Sundays outside the last 8 (not a habit).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_beans
  from unnest(array['2026-09-27','2026-09-13','2026-08-30']::date[]) as t(d);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, note)
  select v_hist, t.d, 'dinner', 'eat_out', 'Out with friends'
  from unnest(array['2026-09-20','2026-09-06','2026-08-23','2026-08-16','2026-08-09']::date[]) as t(d);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_pasta
  from unnest(array['2026-08-02','2026-07-26','2026-07-19']::date[]) as t(d);

  -- Mon: soup on the only 2 planned Mondays (2 of 2, below the bar of 3).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_soup
  from unnest(array['2026-09-28','2026-09-21']::date[]) as t(d);

  -- Tue: tacos on the only 3 planned Tuesdays, 10-12 weeks back (3 of 3: unplanned weeks do not dilute).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_tacos
  from unnest(array['2026-07-21','2026-07-14','2026-07-07']::date[]) as t(d);

  -- Wed: stew 3 times, all before the 2026-06-10 window start (not a habit).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_stew
  from unnest(array['2026-06-03','2026-05-27','2026-05-20']::date[]) as t(d);

  -- T1: Thu 2026-10-01 .. Wed 2026-10-07; Sunday already taken by an eat-out.
  insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, date '2026-10-01', date '2026-10-07') returning id into v_t1;
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, note)
    values (v_t1, date '2026-10-04', 'dinner', 'eat_out', 'Dinner with friends');

  -- T2: Thu 2026-10-08 .. Wed 2026-10-14; Monday has a stir-fry (gives Shop a list).
  insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, date '2026-10-08', date '2026-10-14') returning id into v_t2;
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
    values (v_t2, date '2026-10-12', 'dinner', 'cook', r_stirfry);
end $$;
