-- Sample data for the reflow review board. LOCAL stack only — never prod.
-- Columns confirmed against supabase/schema.sql 2026-07-02.
do $$
declare
  v_user uuid;
  r_chicken uuid; r_chili uuid; r_salmon uuid; r_pasta uuid;
  v_plan uuid;
  v_tonight uuid; v_chili_item uuid;
begin
  select id into v_user from auth.users where email = 'reviewer@local.test';
  if v_user is null then
    raise exception 'reviewer@local.test not found — run the sign-up phase first';
  end if;
  if exists (select 1 from public.meal_plans where user_id = v_user) then
    raise notice 'already seeded — skipping';
    return;
  end if;

  insert into public.recipes (user_id, name, base_servings) values
    (v_user, 'Lemon Chicken Thighs', 2) returning id into r_chicken;
  insert into public.recipe_steps (recipe_id, step_number, body) values
    (r_chicken, 1, 'Pat the chicken thighs dry and season all over with salt.'),
    (r_chicken, 2, 'Sear the chicken thighs skin-side down in olive oil until golden, about 6 minutes.'),
    (r_chicken, 3, 'Add the garlic, squeeze in the lemon, and scrape up the browned bits.'),
    (r_chicken, 4, 'Roast 15 minutes, rest 5, then serve.');
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (r_chicken, 'chicken thighs', 1.5, 'lb', false),
    (r_chicken, 'lemon', 2, 'item', false),
    (r_chicken, 'garlic', 4, 'item', false),
    (r_chicken, 'olive oil', 2, 'tbsp', true),
    (r_chicken, 'salt', 1, 'tsp', true);

  insert into public.recipes (user_id, name, base_servings) values
    (v_user, 'Weeknight Chili', 4) returning id into r_chili;
  insert into public.recipe_steps (recipe_id, step_number, body) values
    (r_chili, 1, 'Brown the ground beef with the onion.'),
    (r_chili, 2, 'Stir in chili powder and cumin until fragrant.'),
    (r_chili, 3, 'Add crushed tomatoes and kidney beans; simmer 25 minutes.');
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (r_chili, 'ground beef', 1, 'lb', false),
    (r_chili, 'onion', 1, 'item', false),
    (r_chili, 'crushed tomatoes', 2, 'cup', false),
    (r_chili, 'kidney beans', 2, 'cup', false),
    (r_chili, 'chili powder', 2, 'tbsp', true),
    (r_chili, 'cumin', 1, 'tsp', true);

  insert into public.recipes (user_id, name, base_servings) values
    (v_user, 'Sheet-Pan Salmon', 2) returning id into r_salmon;
  insert into public.recipe_steps (recipe_id, step_number, body) values
    (r_salmon, 1, 'Start the jasmine rice.'),
    (r_salmon, 2, 'Toss the broccoli in soy sauce; roast with the salmon fillet 12 minutes.'),
    (r_salmon, 3, 'Serve the salmon over rice.');
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (r_salmon, 'salmon fillet', 1, 'lb', false),
    (r_salmon, 'broccoli', 1, 'lb', false),
    (r_salmon, 'jasmine rice', 1.5, 'cup', false),
    (r_salmon, 'soy sauce', 2, 'tbsp', true);

  insert into public.recipes (user_id, name, base_servings) values
    (v_user, 'Caprese Pasta', 2) returning id into r_pasta;
  insert into public.recipe_steps (recipe_id, step_number, body) values
    (r_pasta, 1, 'Boil the rigatoni.'),
    (r_pasta, 2, 'Warm cherry tomatoes in olive oil until they burst.'),
    (r_pasta, 3, 'Toss with mozzarella and basil off the heat.');
  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (r_pasta, 'rigatoni', 12, 'oz', false),
    (r_pasta, 'cherry tomatoes', 1, 'lb', false),
    (r_pasta, 'fresh mozzarella', 8, 'oz', false),
    (r_pasta, 'basil', 1, 'item', false),
    (r_pasta, 'olive oil', 1, 'tbsp', true);

  insert into public.meal_plans (user_id, start_date, end_date, order_date, pickup_date)
    values (v_user, date '2026-07-01', date '2026-07-07', date '2026-07-03', date '2026-07-04')
    returning id into v_plan;

  -- tonight's dinner → Today hero + Cook mode entry
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
    values (v_plan, date '2026-07-02', 'dinner', 'cook', r_chicken) returning id into v_tonight;
  -- leftover pill in the week peek (leftovers carry the source recipe_id per slot_recipe_check)
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, leftover_from_item_id)
    values (v_plan, date '2026-07-03', 'lunch', 'leftover', r_chicken, v_tonight);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
    values (v_plan, date '2026-07-03', 'dinner', 'cook', r_chili) returning id into v_chili_item;
  -- eat-out note inline (flag P4's second half)
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, note)
    values (v_plan, date '2026-07-04', 'dinner', 'eat_out', 'Pizza with the Hendersons');
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, leftover_from_item_id)
    values (v_plan, date '2026-07-05', 'lunch', 'leftover', r_chili, v_chili_item);
  -- serving multiplier visible on the slot row
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id, serving_multiplier)
    values (v_plan, date '2026-07-05', 'dinner', 'cook', r_salmon, 1.25);
  -- multi-item slot → stacked rows + "add another" (flag P4)
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id) values
    (v_plan, date '2026-07-06', 'dinner', 'cook', r_pasta),
    (v_plan, date '2026-07-06', 'dinner', 'cook', r_chicken);
end $$;
