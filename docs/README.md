# Project Documentation

The files in this directory are Meal Queue's durable project memory. They are
kept in Git so a new working session can recover context without relying on a
previous conversation.

## Reading Order

At the start of a new session, read:

1. [`CURRENT_STATE.md`](CURRENT_STATE.md) for the handoff and present reality.
2. [`ROADMAP.md`](ROADMAP.md) for approved work and its order.
3. Relevant sections of [`DECISIONS.md`](DECISIONS.md) and
   [`ARCHITECTURE.md`](ARCHITECTURE.md).
4. Recent entries in [`HISTORY.md`](HISTORY.md).
5. [`OPERATIONS.md`](OPERATIONS.md) before database or deployment work.

## Document Ownership

- [`CURRENT_STATE.md`](CURRENT_STATE.md): Current behavior, known risks, active
  work, and the next concrete action.
- [`ROADMAP.md`](ROADMAP.md): Planned milestones, priority, and acceptance
  criteria.
- [`HISTORY.md`](HISTORY.md): Append-only record of completed outcomes and
  important discoveries.
- [`DECISIONS.md`](DECISIONS.md): Product and technical choices with rationale.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): System structure, data flow, and
  invariants.
- [`OPERATIONS.md`](OPERATIONS.md): Setup, verification, migration, deployment,
  and rollback procedures.
- [`PRODUCT.md`](PRODUCT.md): Product purpose, audience, workflows, and
  boundaries.

## Update Rules

Every completed change must update the documents it affects, whether it is
merged through a pull request or committed directly:

- Update `CURRENT_STATE.md` when behavior, risks, architecture, branch status,
  or the next action changes.
- Update `ROADMAP.md` when work starts, completes, changes order, or is
  deferred.
- Append a dated `HISTORY.md` entry for completed milestones, merged pull
  requests, migrations, or significant decisions.
- Update `DECISIONS.md` for meaningful choices or reversals.
- Update `ARCHITECTURE.md` and `OPERATIONS.md` when their described behavior
  changes.

Record outcomes and rationale, not full session transcripts. Git remains the
detailed record of individual code changes.

Before ending a working session, follow the session-wrap process in
[`OPERATIONS.md`](OPERATIONS.md).
