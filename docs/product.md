# Product

## Purpose

Meal Queue is a private meal planner, recipe keeper, and grocery-list generator
for a single person or household. It reduces the repeated work of deciding what
to cook, scaling recipes, and assembling an order-ready grocery list. It is
optimized for personal/household use; there are no multi-user, sharing, or
public-product features.

## Primary Workflow

1. Save and organize recipes.
2. Create a custom-date meal plan.
3. Add cooked meals, leftovers, or eating-out entries to plan days (each day
   is one flat meal list — the lunch/dinner division was dropped 2026-07-02).
4. Adjust recipe serving multipliers when needed.
5. Generate a grocery list from cooked meals.
6. Mark pantry or on-hand items and check off purchased items.

## Product Boundaries

- The product is currently optimized for one authenticated household account.
- It is a responsive web app, with desktop browsers and iPhone Safari as the
  primary targets.
- Pantry handling is per grocery trip; there is no persistent pantry inventory.
- Grocery grouping uses exact unit matches and does not perform conversions.
- Nutrition, recipe sharing, public discovery, and monetization are outside the
  current roadmap.

## Current Routes

See [routes.md](routes.md) for the full route map and per-page intent docs.

- `/`: Today (reflow home) — tonight's meals, grocery deadline, week peek.
- `/recipes`: Recipe library and editor.
- `/recipes/[id]`: Recipe cooking and serving view.
- `/plans`: Plan creation, history, and meal scheduling.
- `/grocery`: Generated grocery lists and checklist state.
- `/settings`: Account and planning defaults.

## Success Criteria

- A household can complete the weekly recipe-to-grocery workflow without
  re-entering data.
- Existing recipe, plan, and checklist data is not lost during normal edits or
  application upgrades.
- Mobile interactions remain practical while shopping or cooking.
