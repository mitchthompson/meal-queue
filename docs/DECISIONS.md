# Product Decisions (Current)

## Confirmed

- Lunch and dinner are both supported, but optional in planning.
- Meal plans use custom `start_date` and `end_date` (settings provide defaults).
- Order day and pickup day default from settings for new plans, but each plan stores its own dates so history is preserved.
- Ingredient units should come from a controlled list for V1.
- Tags are user-created; app ships with suggested tags.
- Grocery list state persists for a meal plan and only refreshes when that plan changes.
- V1 can scaffold core app first, then deepen auth flows.
- UI should work well on both desktop and iPhone Safari.

## Instruction Model Recommendation

Use structured steps (`recipe_steps` table) as the canonical format for scalability.

Why:
- Web import and OCR parsing can map naturally into discrete steps.
- Future features (timers, step checkoff, voice mode, smart highlighting) depend on step structure.
- Editing UX is cleaner with reorderable step rows.

Implementation detail:
- Keep optional `instructions_raw` text on `recipes` for ingest/debug.
- Parse/import pipeline writes normalized rows to `recipe_steps`.
