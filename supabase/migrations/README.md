# Supabase Migrations

This directory contains ordered, forward-only migrations for the live Meal
Queue database.

## Naming

Use UTC timestamps followed by a concise description:

```text
YYYYMMDDHHMMSS_description.sql
```

Example:

```text
20260609183000_atomic_recipe_save.sql
```

## Migration Requirements

Each migration must:

- Be safe for existing household data.
- Include read-only preflight queries before statements that may reject
  existing rows.
- Prefer additive changes and explicit backfills.
- Document rollback or forward-recovery steps in SQL comments.
- Be reflected in `supabase/schema.sql`.

The live database predates this directory, and `supabase/schema.sql` remains
the canonical full-schema reference. New migrations begin with the next actual
schema change. Apply reviewed migrations through the Supabase SQL editor; prod
is hand-applied and `supabase db push` is **not** used.

## CI/local-only baseline migration

`20260101000000_baseline_schema.sql` is a CI/LOCAL-ONLY baseline. It is a
verbatim, regenerable copy of `supabase/schema.sql`, timestamped to sort BEFORE
the real migrations, so that a fresh EPHEMERAL local/CI database (built by
`supabase start` / `supabase db reset`) gets the full schema before the
`save_recipe` migration validates. Without it, applying only the `save_recipe`
migration to an empty database fails — its body references tables that do not
yet exist and `check_function_bodies` (on by default) rejects it.

- **NEVER apply this baseline to prod.** Prod already has this schema
  (hand-applied via the SQL editor). `supabase db push` is never run against
  the live project, so the baseline never reaches it.
- It supersedes the earlier "there is no synthetic baseline migration"
  decision FOR THE LOCAL/CI PATH ONLY (see `docs/decisions.md` →
  Superseded Decisions).
- Regenerate whenever `schema.sql` changes:
  `cp supabase/schema.sql supabase/migrations/20260101000000_baseline_schema.sql`.
  A CI guard enforces this: the db-tests job's "Baseline schema matches
  schema.sql" step (before `supabase start`) fails the run if the two ever
  drift, printing the exact regenerate command.
