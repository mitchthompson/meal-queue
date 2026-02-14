# Implementation Plan

## Phase 0: Setup

1. Create Next.js app shell and Supabase client wiring.
2. Add environment config and type-safe app constants.
3. Apply initial SQL schema + RLS policies.

## Phase 1: Foundation (Recipes + Settings)

1. Auth guard and session plumbing.
2. User settings page:
- default plan length
- default meal-plan week start day
- default order/pickup weekdays
3. Recipe CRUD:
- core fields
- ingredients with controlled units
- pantry-staple flag
- structured instruction steps
4. Tag system:
- suggested starter tags on first-use
- user-created tags and recipe associations

## Phase 2: Meal Planning

1. Create meal plan from settings defaults (user can override dates).
2. Calendar/list planning UI that supports optional lunch and dinner slots.
3. Add recipe to plan with serving override.
4. Persist per-plan order and pickup dates.

## Phase 3: Grocery Lists

1. Generate persisted grocery list rows from meal plan items.
2. Combine amounts only when ingredient name + unit match exactly.
3. Separate pantry staples into their own collapsible section.
4. Checkbox state persists for the meal plan.
5. Regenerate list when plan items/servings change.

## Phase 4: UX Refinement

1. Improve recipe input speed.
2. Add import pipeline placeholders (URL paste / OCR-ready endpoint contract).
3. Mobile and desktop polish passes.

## Technical Notes

- Keep meal-plan date ranges explicit (`start_date`, `end_date`) to support non-week use-cases.
- Materialize grocery list rows instead of only computing on-the-fly; this preserves checklist state.
- Add `meal_plans.version` and regenerate grocery rows when version changes.
