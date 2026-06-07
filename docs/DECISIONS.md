# Decisions

This document records choices that should survive individual implementation
sessions. Add a dated entry when a product or technical decision changes. Mark
replaced decisions as superseded rather than silently deleting them.

## Active Decisions

### Product Scope

- Meal Queue is optimized for personal or household use, not public-product
  scale.
- Lunch and dinner are optional planning slots.
- A meal slot may contain multiple recipes, a leftover reference, or an
  eating-out note.
- Meal plans use explicit `start_date` and `end_date` values rather than a
  fixed calendar week.
- Order and pickup weekdays provide defaults, while each plan stores its actual
  dates so historical plans remain accurate.
- The primary targets are desktop browsers and iPhone Safari.

### Recipes and Ingredients

- Structured `recipe_steps` are canonical. Optional `instructions_raw` is kept
  for imports and debugging.
- Ingredient units come from a controlled list.
- Grocery quantities combine only when normalized ingredient name, unit, and
  pantry classification match exactly. Unit conversion is deferred.
- Tags are user-created, with starter suggestions supplied by the app.

### Grocery State

- Grocery rows are persisted so checklist state survives page navigation.
- Pantry staples, on-hand state, and checked state belong to a specific plan.
- Reliability work must preserve unchanged user state when a grocery list is
  regenerated.

### Engineering Workflow

- Existing Supabase data is live data and must be preserved with additive
  migrations and preflight checks.
- Implementation work uses focused branches prefixed with `codex/`.
- Pull requests are a risk-management tool rather than a requirement for every
  change. Use them for database migrations, broad refactors, risky behavior
  changes, or whenever a deliberate review checkpoint is useful.
- Small, low-risk, and documentation-only changes may be committed directly to
  `main` after review and verification.
- Useful incomplete work stays on a pushed feature branch with an explicit
  handoff. Checkpoint commits may be squashed before merge.
- Documentation updates are part of each completed change's acceptance
  criteria.
- `CURRENT_STATE.md` describes present reality, `ROADMAP.md` describes future
  work, and `HISTORY.md` records completed outcomes.
- Every session ends with the documented session-wrap process so the next
  session can resume without relying on conversation history.

## Superseded Decisions

None recorded yet.
