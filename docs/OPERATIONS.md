# Operations

## Local Development

Requirements:

- Node.js and npm.
- A Supabase project.
- `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Commands:

```powershell
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```

Open `http://localhost:3000`.

## Git Workflow

Start each change by fetching `origin` and confirming local `main` is current.

### Low-Risk Changes

Documentation, small fixes, and other narrowly scoped changes may be committed
directly to `main` when:

- The diff is easy to review.
- No database migration or risky behavior change is involved.
- Appropriate verification passes.
- The commit remains focused and reversible.

### Feature Branches

Use a focused `codex/...` branch for implementation work, incomplete work that
must survive between sessions, or any change that should not immediately land
on `main`.

### Pull Requests

Use a pull request when a change includes:

- A database migration or live-data risk.
- A broad refactor or cross-cutting behavior change.
- A difficult rollback.
- A change that benefits from a deliberate review checkpoint.

For lower-risk feature branches, review the diff and merge into `main` without
a pull request when the extra ceremony would not improve safety.

After merging any branch, update local `main` before starting the next change.

Do not commit `.env.local`, `.codex/`, `recipe-export.json`, Supabase temporary
files, or generated build output.

## Change Checklist

- Behavior and motivation are described.
- `CURRENT_STATE.md`, `ROADMAP.md`, and `HISTORY.md` are updated.
- Decisions, architecture, and operations docs are updated when affected.
- Required database migration order and rollback are documented.
- `npm run test` passes once the test suite is introduced.
- `npm run typecheck` passes.
- `npm run build` passes.

## End-of-Session Wrap

Run this process before ending a working session, including sessions that stop
with incomplete work:

1. Inspect the current branch, Git status, and remote tracking state.
2. Review the diff so unrelated or accidental changes are identified.
3. Run verification appropriate to the work completed. Record skipped, failed,
   or blocked checks explicitly.
4. Update `CURRENT_STATE.md`:
   - Stable baseline when merged or deployed state changed.
   - Active branch and work in progress.
   - Exact next concrete action.
   - Blockers and unresolved questions.
   - Database and migration status.
   - Latest verification results.
   - Any intentionally uncommitted files.
5. Update `ROADMAP.md` when milestone status, ordering, or scope changed.
6. Update `DECISIONS.md`, `ARCHITECTURE.md`, or this file when durable project
   knowledge changed.
7. Add a `HISTORY.md` entry only for a completed milestone, merged pull request,
   applied migration, or significant decision. Do not create a diary entry for
   every session.
8. Commit coherent completed work. If unfinished work is valuable, create a
   clearly labeled checkpoint commit on its feature branch and push it. It may
   be squashed before merge.
9. Leave the worktree clean. If that is not appropriate, list every remaining
   uncommitted file and why it is intentionally uncommitted in
   `CURRENT_STATE.md`.
10. Finish with a concise handoff stating what changed, where it lives,
    verification status, and the next action.

## Database Changes

Existing Supabase records are live data.

For each schema change:

1. Add an ordered SQL file under `supabase/migrations/` using
   `YYYYMMDDHHMMSS_description.sql`.
2. Include read-only preflight queries for incompatible existing rows.
3. Prefer additive schema changes and backfills.
4. Document rollback or forward-recovery steps.
5. Keep `supabase/schema.sql` synchronized as the canonical full schema.
6. Review the pull request before applying SQL.
7. Run preflight queries in the Supabase SQL editor.
8. Apply the migration through the SQL editor.
9. Verify data and application behavior before deploying dependent client code.

Stop if preflight checks return incompatible data. Do not reset the database or
discard user records to make a migration pass.

See `supabase/migrations/README.md` for the migration-file contract and baseline
policy.

## Deployment and Rollback

- Apply backward-compatible database migrations before dependent application
  code.
- Verify the current production workflow after migration and after deployment.
- For client-only regressions, redeploy the prior known-good commit.
- For database regressions, follow the migration's documented recovery steps;
  do not assume a destructive down migration is safe.

## Tooling Status

- Git remote: `https://github.com/mitchthompson/meal-queue.git`.
- GitHub CLI is not installed.
- Supabase CLI is not installed.
- Pull requests use GitHub's web interface.
- Database changes currently use the Supabase SQL editor.
