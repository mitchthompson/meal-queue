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
- [current-state.md](current-state.md) describes present reality,
  [roadmap.md](roadmap.md) describes future work, and
  [progress-log.md](progress-log.md) records completed outcomes.
- Every session ends with the documented session-wrap process so the next
  session can resume without relying on conversation history.

### Reliability Implementation (2026-06-11)

- Database reliability fixes (atomic recipe saves, version increments, grocery
  regeneration) are implemented with Postgres functions and triggers rather
  than client-side orchestration. Functions use security-invoker semantics so
  row-level security continues to apply; the service-role MCP path is the
  deliberate exception.
- The reliability scope is milestones 2-4 in roadmap order. Quick-win fixes,
  grocery-staleness redesign, and the component refactor are deferred and
  recorded in [roadmap.md](roadmap.md) so they are not lost.
- The `mcp/` recipe-import server source is tracked in Git. `.mcp.json`,
  build output, and `node_modules` remain ignored because they hold secrets or
  generated content.

### Front-End Improvements (2026-06-11)

- UI improvement work (feedback overhaul, mobile ergonomics, loading polish)
  runs after the reliability core so data-integrity fixes land first.
- Accessibility fixes are folded into related UI work rather than tracked as
  a separate milestone.
- Auth flow completion (sign-up confirmation messaging, password reset) is
  deferred until a need arises; this is a single-household app.

### Dates and Migrations

- Meal-plan dates are calendar dates, not UTC timestamps. Shared date helpers
  construct `YYYY-MM-DD` values from local calendar fields to avoid timezone
  shifts.
- `supabase/schema.sql` remains the canonical full-schema reference.
- New database changes use timestamped, forward-only files under
  `supabase/migrations/`. There is no synthetic baseline migration for the
  already-live database.

### Documentation and Design System (2026-06-19)

- The lowercase-kebab documentation system is canonical. The old UPPERCASE docs
  are renamed to their lowercase-kebab equivalents (for example
  [product.md](product.md), [architecture.md](architecture.md),
  [current-state.md](current-state.md)). `CLAUDE.md` at the repo root is the
  always-loaded anchor that points into the docs set and holds the canonical
  end-of-session checklist.
- The design source of truth lives in the repo, not in an external design tool
  (no Figma). Data truth is `supabase/schema.sql` plus
  [data-model.md](data-model.md); UI truth is the CSS-variable tokens in
  `app/globals.css` plus [design-system.md](design-system.md); per-page intent
  lives in the per-page docs under `docs/pages/`. Confirm against these live
  files before building; a missing value is flagged in
  [design-flags.md](design-flags.md), never invented.
- No CSS class prefix is used. Meal Queue is a single self-contained app that
  does not share the DOM with anything else, so the CSS-variable token system in
  `app/globals.css` is the namespace. All color, spacing, and typography flow
  through the `--color-*` variables and their semantic aliases (`--bg`,
  `--surface`, `--ink`, `--muted`, `--brand`, `--brand-2`, `--line`, and
  related); one-off hex, font, or spacing values are never inlined in
  components.

## Superseded Decisions

None recorded yet.
