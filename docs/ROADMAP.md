# Roadmap

Reliability is the current priority. Existing household data must remain
compatible throughout this work.

## Active Milestones

### 0. Documentation Foundation

Branch: `codex/docs-foundation`

- Establish durable project-memory documents.
- Reconcile outdated project and implementation notes.
- Ignore local Codex metadata and recipe exports.
- Make documentation updates part of every pull request.

Acceptance:

- A new session can identify current state, next work, important decisions, and
  operating procedures by following `docs/README.md`.
- No obsolete document presents completed work as a future plan.

### 1. Reliability Foundation

Planned branch: `codex/reliability-foundation`

- Add Vitest and core test scripts.
- Extract testable date, ingredient scaling, and grocery grouping functions.
- Add tests for those behaviors.
- Establish `supabase/migrations/` while keeping `schema.sql` canonical.

Acceptance:

- `npm run test`, `npm run typecheck`, and `npm run build` pass.
- Migration naming and application procedures are documented.

### 2. Atomic Recipe Saves

Planned branch: `codex/atomic-recipe-saves`

- Add a transactional Supabase function for complete recipe saves.
- Replace client-side delete-and-reinsert recipe updates.
- Invalidate affected meal-plan grocery generations after ingredient changes.
- Preserve the editable form and show useful feedback when a save fails.

Acceptance:

- Any invalid child row rolls back the complete recipe update.
- Ingredient changes make every affected grocery list stale.

### 3. Plan Integrity

Planned branch: `codex/plan-integrity`

- Move plan version increments to database triggers.
- Remove client-side version read/update sequences.
- Add preflight queries and constraints for plan ranges, ownership, and
  leftovers.

Acceptance:

- Concurrent mutations cannot lose version increments.
- Invalid dates, cross-owner references, and invalid leftovers are rejected.
- Existing data passes preflight checks before constraints are applied.

### 4. Grocery State Preservation

Planned branch: `codex/grocery-state-preservation`

- Add transactional grocery regeneration.
- Give generated items stable identities within a plan.
- Preserve checked, on-hand, and pantry override state for unchanged items.
- Remove obsolete rows only after replacement generation succeeds.

Acceptance:

- Regeneration never exposes a partially rebuilt list.
- Unchanged items retain user state; removed ingredients disappear.

### 5. Component Hardening

Planned branch: `codex/component-hardening`

- Split oversized recipe, planning, and grocery route components.
- Centralize shared date and Supabase data-access logic.
- Improve retry and failure feedback without redesigning workflows.

Acceptance:

- User-visible behavior remains compatible.
- Shared logic has focused automated coverage.

## Deferred Ideas

- Recipe import from URL or pasted text.
- OCR-assisted recipe capture.
- Unit conversions during grocery grouping.
- Meal-plan templates.
- Recipe sharing, nutrition data, and public-product features.
- PWA and offline support.
