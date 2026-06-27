# QA & Verification

How to verify a change before it lands. This file owns the verification
commands, the per-change-type acceptance checklists, and the migration
preflight rules.

Deploy, setup, and rollback live in [architecture.md](architecture.md) — link,
don't duplicate. The end-of-session wrap-up is canonical in
[CLAUDE.md](../CLAUDE.md) — see below.

## Verification Commands

Run from the repo root:

```powershell
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (one-shot)
```

Add the production build when the change can affect the build output:

```powershell
npm run build       # next build — run when shipping a build-affecting change
```

Record any check that is skipped, failed, or blocked explicitly — never imply a
check passed when it was not run.

## Acceptance / QA by Change Type

Every change should describe its behavior and motivation, stay focused and
reversible, and pass the verification appropriate to its type. Documentation
that became inaccurate (see the doc set in [README.md](README.md)) is updated as
part of the change.

### Docs-only

- The diff is easy to review.
- Internal links and filenames are correct (use the lowercase-kebab doc names).
- No code, schema, or behavior change is bundled in.
- Lint/typecheck/test are not required unless the change touches code or config.

### UI

- `npm run lint` and `npm run typecheck` pass.
- `npm run test` passes.
- `npm run build` passes (UI changes can affect the build).
- No hardcoded design values — all color/spacing/typography flow through the
  `--color-*` tokens and their semantic aliases in
  [`app/globals.css`](../app/globals.css). A missing token is added there and
  documented in [design-system.md](design-system.md), or flagged in
  [design-flags.md](design-flags.md) — never inlined.
- Verified against the per-page intent in [pages/](pages/) and the tokens in
  [design-system.md](design-system.md).
- Checked on the primary targets: desktop browsers and iPhone Safari.

### Logic (lib/ and other code)

- `npm run lint` and `npm run typecheck` pass.
- `npm run test` passes; domain logic in `lib/` has Vitest coverage for the
  changed behavior.
- `npm run build` passes when the change can affect the build.
- Inputs are validated with Zod where user data crosses a boundary.
- No schema column, default, or data value is guessed — confirm against
  [`supabase/schema.sql`](../supabase/schema.sql) /
  [data-model.md](data-model.md), or flag it in
  [design-flags.md](design-flags.md).

### DB / Migration

Database migrations are a risk action and go through a pull request. Existing
Supabase records are live household data — do not reset the database or discard
records to make a migration pass.

- A pull request is opened and reviewed before any SQL is applied.
- An ordered SQL file exists under `supabase/migrations/` named
  `YYYYMMDDHHMMSS_description.sql`.
- The change is additive (new columns/backfills) where possible.
- Migration order and rollback / forward-recovery steps are documented.
- [`supabase/schema.sql`](../supabase/schema.sql) is kept synchronized as the
  canonical full schema.
- Preflight checks pass (see below) before applying.
- Data and application behavior are verified after applying and before
  deploying dependent client code.
- All code verification above (lint, typecheck, test, build) passes for any
  client code that depends on the new schema.

See [`supabase/migrations/README.md`](../supabase/migrations/README.md) for the
migration-file contract and baseline policy, and
[architecture.md](architecture.md) for how migrations are applied and rolled
back.

## Migration Preflight

Before applying any schema change:

1. Include read-only preflight queries that find existing rows incompatible
   with the change.
2. Run those preflight queries in the Supabase SQL editor.
3. **Stop if any preflight check returns incompatible data.** Do not reset the
   database or discard user records to force the migration through.
4. Only after preflight is clean, apply the migration through the SQL editor,
   then verify data and behavior before deploying dependent client code.

## End-of-Session Checklist

Run the canonical end-of-session wrap before ending any working session,
including sessions that stop with incomplete work — see the
**End-of-session checklist** in [CLAUDE.md](../CLAUDE.md).
