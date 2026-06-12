# Current State

Last reviewed: 2026-06-11

## Stable Baseline

- **Last completed work:** Hybrid Git and end-of-session workflow documentation
  committed directly to `main` as `3bfddfa`.
- **Last pull request:** Documentation foundation in PR #1, merge commit
  `0108c44`.
- **Current branch:** `main`, tracking `origin/main`.
- **Remote:** `origin` points to
  `https://github.com/mitchthompson/meal-queue.git`.
- **Database status:** Existing Supabase data is treated as live. The repository
  has a canonical schema file and a documented forward-only migration
  directory. No database migration has been applied yet.
- **Latest application verification:** `npm run test`, `npm run typecheck`, and
  `npm run build` passed on 2026-06-09 on the reliability foundation branch.
- **Latest documentation verification:** Internal Markdown links and
  `git diff --check` passed on 2026-06-09.

## Active Handoff

- **In progress:** Independent code audit and finalized reliability plan on
  `codex/code-audit-plan` (branched from `codex/reliability-foundation`).
  Audit findings live in `docs/CODE_AUDIT_2026-06-11.md`; the `mcp/` server
  source is now tracked in Git.
- **Next action:** Open and merge the pull request for
  `codex/reliability-foundation`, then merge `codex/code-audit-plan`, then
  start milestone 2 on `codex/atomic-recipe-saves`.
- **Blockers:** None.
- **Uncommitted work:** None after the audit commit.

## Working Product

- Email/password authentication through Supabase.
- Dashboard with current and upcoming meal-plan and grocery summaries.
- Recipe create, edit, delete, search, sort, tagging, structured steps, pantry
  flags, and serving previews.
- Meal plans with custom ranges, lunch and dinner slots, multiple recipes per
  slot, leftovers, eating-out notes, and serving multipliers.
- Grocery generation with exact-match ingredient grouping, pantry sections,
  on-hand state, and checkboxes.
- User defaults for plan length, week start, grocery order day, and pickup day.
- Responsive navigation and layouts for desktop and mobile browsers.

## Architecture Snapshot

- Next.js 15 App Router and React 19.
- Client components query Supabase directly through the browser client.
- Supabase Postgres stores application data and enforces owner-based row-level
  security.
- Most screen behavior currently lives in large route components:
  `app/plans/page.tsx`, `app/recipes/page.tsx`, and
  `app/grocery/page.tsx`.
- Pure date calculations live in `lib/date-utils.ts`.
- Grocery scaling, normalization, grouping, and amount formatting live in
  `lib/grocery.ts`.
- Vitest covers the extracted domain logic.
- `supabase/schema.sql` is the canonical full schema, and new forward-only
  changes belong in `supabase/migrations/`.

## Known Reliability Risks

- Recipe save is a client-side sequence of parent update, child deletion, and
  child insertion. A failure can leave a partially updated recipe.
- Editing recipe ingredients does not invalidate grocery lists for plans using
  that recipe.
- Grocery regeneration deletes and recreates rows, resetting checked, on-hand,
  and manually changed pantry state.
- Plan version bumps use separate client-side read and update requests, which
  can lose concurrent increments.
- Database constraints do not fully enforce meal dates, same-owner references,
  or valid leftover relationships.
- Automated coverage currently protects date and grocery calculations, but not
  Supabase write flows or UI interactions.
- Plan version bumps fire for every plan mutation, including changes that do
  not affect groceries, and the grocery page regenerates silently on load, so
  minor plan tweaks wipe checklist state without user action.
- The dashboard loads items for only the 4 newest plans by start date; with
  several future plans the current week can render empty.
- `ensureUserSettings` runs twice per sign-in, and default settings values are
  duplicated across three files inconsistently with the SQL defaults.

## Repository Notes

- `main` tracks `origin/main`.
- Use focused `codex/...` branches for implementation work.
- Pull requests are required for database migrations, broad refactors, and
  other high-risk changes. Low-risk and documentation-only work may be
  committed directly to `main`.
- `.env.local`, `.codex/`, `.mcp.json`, and `recipe-export.json` are
  local-only. The `mcp/` recipe-import server source is tracked in Git as of
  2026-06-11; its build output and `node_modules` are not.
- GitHub CLI and Supabase CLI are not currently installed. Pull requests are
  opened in GitHub's web interface, and migrations are applied through the
  Supabase SQL editor.
- Next.js is patched to `15.5.19`; targeted transitive overrides keep npm audit
  at zero known vulnerabilities.
