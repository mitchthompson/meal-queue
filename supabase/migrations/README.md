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

There is no synthetic baseline migration. The live database predates this
directory, and `supabase/schema.sql` remains the canonical full-schema
reference. New migrations begin with the next actual schema change.

Apply reviewed migrations through the Supabase SQL editor until the Supabase CLI
is introduced.
