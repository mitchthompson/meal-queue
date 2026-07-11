# Project Documentation

These files are Meal Queue's durable project memory. They are kept in Git so a
new working session can recover context without relying on a previous
conversation.

The always-loaded anchor lives at the repo root: [`CLAUDE.md`](../CLAUDE.md). It
holds the working rules, stack, anti-goals, commands, and the canonical
end-of-session checklist. **Start every session with
[`current-state.md`](current-state.md)** to learn the present reality before
doing anything else.

## Reading Order

At the start of a new session, read in this order:

1. [`current-state.md`](current-state.md) — the handoff and present reality.
2. [`roadmap.md`](roadmap.md) — approved work and its order.
3. Relevant sections of [`decisions.md`](decisions.md) and
   [`architecture.md`](architecture.md).
4. Recent entries in [`progress-log.md`](progress-log.md).
5. Before building UI, the relevant [`pages/`](pages) intent doc plus
   [`design-system.md`](design-system.md). Before database work,
   [`data-model.md`](data-model.md) and the canonical schema in
   [`supabase/schema.sql`](../supabase/schema.sql).
6. [`qa.md`](qa.md) before verifying or shipping; [`architecture.md`](architecture.md)
   before deployment, setup, or migration work.

## Documents

**State and planning**

- [`current-state.md`](current-state.md) — current behavior, known risks, active
  work, branch status, and the next concrete action. Read first every session.
- [`roadmap.md`](roadmap.md) — planned milestones, priority, and acceptance
  criteria.
- [`progress-log.md`](progress-log.md) — append-only record of completed
  outcomes and important discoveries.
- [`decisions.md`](decisions.md) — product and technical choices with rationale.
- [`plans/`](plans/) — builder-ready milestone and fix specs written for
  handoff. A spec's Status line asserts current state; the body is intent and
  may predate reality by design.

**Reference**

- [`setup.md`](setup.md) — local dev setup for a new machine (clone, env,
  run, verify) and the Claude Code kickoff prompt.
- [`product.md`](product.md) — product purpose, audience, workflows, and
  boundaries.
- [`architecture.md`](architecture.md) — system structure, data flow,
  invariants, and the setup/deploy/migration/rollback procedures.
- [`qa.md`](qa.md) — verification commands, acceptance/QA per change type, and
  preflight checks. The end-of-session checklist is canonical in
  [`CLAUDE.md`](../CLAUDE.md); `qa.md` links to it.
- [`data-model.md`](data-model.md) — human-readable data model derived from
  [`supabase/schema.sql`](../supabase/schema.sql) (the canonical schema).
- [`routes.md`](routes.md) — the App Router routes and what each renders.

**Design**

- [`design-system.md`](design-system.md) — UI source of truth: the CSS-variable
  tokens in [`app/globals.css`](../app/globals.css) and their semantic aliases.
- [`design-flags.md`](design-flags.md) — open design questions and unconfirmed
  values awaiting decision. A missing token or value is flagged here, never
  invented.
- [`redesign-brief.md`](redesign-brief.md) — the reflow's owner-approved
  direction and per-screen intent (2026-07-02). Mockup source lives in
  [`mockups/`](mockups/), the app-icon source in [`assets/`](assets/).

**Per-page intent** ([`pages/`](pages))

- [`pages/today.md`](pages/today.md) — Today (home screen) page intent.
- [`pages/recipes.md`](pages/recipes.md) — recipes page intent.
- [`pages/plans.md`](pages/plans.md) — meal-plans page intent.
- [`pages/grocery.md`](pages/grocery.md) — grocery page intent.
- [`pages/settings.md`](pages/settings.md) — settings page intent.

**Dated audit artifacts** (point-in-time; do not edit)

- [`CODE_AUDIT_2026-06-11.md`](CODE_AUDIT_2026-06-11.md) — code reliability audit.
- [`UI_AUDIT_2026-06-11.md`](UI_AUDIT_2026-06-11.md) — front-end UI audit.

## Document Ownership

Each topic has one owning document. Put new information where it belongs rather
than duplicating it:

- Present reality, risks, active work, next action → [`current-state.md`](current-state.md).
- Planned milestones and acceptance criteria → [`roadmap.md`](roadmap.md).
- Completed outcomes and discoveries → [`progress-log.md`](progress-log.md).
- Choices and reversals with rationale → [`decisions.md`](decisions.md).
- Purpose, audience, workflows, boundaries → [`product.md`](product.md).
- System structure, data flow, invariants, and ops procedures →
  [`architecture.md`](architecture.md).
- Verification and acceptance per change type → [`qa.md`](qa.md).
- Schema-derived data model → [`data-model.md`](data-model.md) (schema truth is
  [`supabase/schema.sql`](../supabase/schema.sql)).
- Routes → [`routes.md`](routes.md); per-page intent → [`pages/`](pages).
- Design tokens → [`design-system.md`](design-system.md) (token truth is
  [`app/globals.css`](../app/globals.css)); open design questions →
  [`design-flags.md`](design-flags.md).

## Update Rules

Every completed change must update the documents it affects, whether merged
through a pull request or committed directly:

- Update [`current-state.md`](current-state.md) when behavior, risks,
  architecture, branch status, or the next action changes.
- Update [`roadmap.md`](roadmap.md) when work starts, completes, changes order,
  or is deferred.
- Append a dated [`progress-log.md`](progress-log.md) entry for completed
  milestones, merged pull requests, migrations, or significant decisions.
- Update [`decisions.md`](decisions.md) for meaningful choices or reversals.
- Update [`architecture.md`](architecture.md) and [`qa.md`](qa.md) when their
  described behavior changes.
- When a route, page intent, data shape, or design token changes, update the
  owning doc ([`routes.md`](routes.md), [`pages/`](pages),
  [`data-model.md`](data-model.md), [`design-system.md`](design-system.md)). If a
  needed design value is unconfirmed, record it in
  [`design-flags.md`](design-flags.md) — never inline a one-off value.

Record outcomes and rationale, not full session transcripts. Git remains the
detailed record of individual code changes.

The dated audit files are point-in-time artifacts and are not edited; supersede
them with new dated audits when needed.

Before ending a working session, follow the end-of-session checklist in
[`CLAUDE.md`](../CLAUDE.md), referenced from [`qa.md`](qa.md).
