# MEAL PLANNER APP - PROJECT BRIEF

## Core Concept

A web-based meal planner, recipe keeper, and grocery list generator for personal use.

## Key Features

### Recipe Management

- Store recipes with ingredients (name, amount, unit, pantry staple flag) and instructions
- Default serving size: 2 people, with ability to scale
- Tag/categorize recipes (protein type, cuisine, cooking method, prep time, etc.)

### Meal Planning

- Weekly calendar view for planning dinners (potentially lunches)
- Assign recipes to specific days/meals
- Adjust servings per meal when adding to plan (e.g., make this recipe for 4 instead of 2)
- Ability to set day for weekly plan to start and end ("Friday to Thursday")
- Abilty to set grocery order day and grocery pickup day for that meal plan (may be in the previous week, like order Wed, pikcup Thursday, for meal plan week starting Friday)

### Grocery List Generation

- Auto-generates from current week's meal plan
- Smart-combines ingredients when units match (e.g., "2 cups flour" + "1 cup flour" = "3 cups flour")
- Shows total quantities needed across all planned meals
- Separates pantry staples (salt, oil, etc.) into collapsible section with option to "move to main list" if actually needed
- One-time checkoff per grocery trip (no persistent pantry inventory)
- Unit combining: Start simple - combine when units match exactly, show separately when they don't

### Workflow

1. Add/organize recipes with tags
2. Build weekly meal plan by selecting recipes and adjusting servings
3. Generate grocery list from meal plan
4. Check off items already in pantry
5. Use list for online grocery ordering

## Technical Stack

- **Frontend/Backend:** Next.js (React framework)
- **Database:** PostgreSQL via Supabase
- **Hosting:** Vercel (free tier)
- **Authentication:** Supabase built-in auth (email/password)

## Database Schema

- `recipes` - id, name, base_servings, instructions, user_id
- `ingredients` - id, recipe_id, name, amount, unit, is_pantry_staple
- `meal_plans` - id, user_id, week_start_date
- `meal_plan_items` - id, meal_plan_id, recipe_id, day, meal_type, servings_multiplier
- `tags` and `recipe_tags` - for recipe organization

## Build Phases

1. **Core foundation:** Next.js setup, Supabase connection, auth, basic recipe CRUD
2. **Meal planning:** Weekly calendar, add recipes to days, servings adjustment, tag/filter system
3. **Grocery list:** Generate from meal plan, smart combining, pantry staples handling, checkoff
4. **Recipe input refinement:** Make adding recipes easy (manual entry, URL import, paste-and-parse, etc.)

## Platform Notes

- Web app accessible via browser (works on iPhone Safari)
- Can add to home screen for app-like experience
- Future: Could become PWA for offline capability
- No mobile app store publishing needed

## Key Implementation Details

- Unit normalization needed for smart combining (handle conversions later, start with exact matches)
- Relational database structure allows for complex queries (all recipes using chicken, recipes under 30 min, etc.)
- User authentication keeps recipes private
- Scalable for future features: recipe sharing, meal plan templates, nutritional info, etc.
