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
npm run typecheck
npm run build
```

Open `http://localhost:3000`.

## Git Workflow

1. Fetch `origin` and fast-forward local `main`.
2. Create one focused `codex/...` branch.
3. Implement the milestone and update relevant documents.
4. Run the required verification.
5. Commit only files belonging to the milestone.
6. Push the branch with upstream tracking.
7. Open and review a pull request through GitHub's web interface.
8. Merge, update local `main`, and branch the next milestone from it.

Do not commit `.env.local`, `.codex/`, `recipe-export.json`, Supabase temporary
files, or generated build output.

## Pull Request Checklist

- Behavior and motivation are described.
- `CURRENT_STATE.md`, `ROADMAP.md`, and `HISTORY.md` are updated.
- Decisions, architecture, and operations docs are updated when affected.
- Required database migration order and rollback are documented.
- `npm run test` passes once the test suite is introduced.
- `npm run typecheck` passes.
- `npm run build` passes.

## Database Changes

Existing Supabase records are live data.

For each schema change:

1. Add an ordered SQL file under `supabase/migrations/`.
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
