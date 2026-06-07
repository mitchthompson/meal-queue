# Current State

Last reviewed: 2026-06-07

## Stable Baseline

- **Last completed work:** Hybrid Git and end-of-session workflow documentation
  committed directly to `main` as `3bfddfa`.
- **Last pull request:** Documentation foundation in PR #1, merge commit
  `0108c44`.
- **Current branch:** `main`, tracking `origin/main`.
- **Remote:** `origin` points to
  `https://github.com/mitchthompson/meal-queue.git`.
- **Database status:** Existing Supabase data is treated as live. The repository
  currently has a canonical schema file but no ordered migration directory.
- **Latest application verification:** `npm run typecheck` and `npm run build`
  passed on 2026-06-07 for the documentation foundation.
- **Latest documentation verification:** Internal Markdown links and
  `git diff --check` passed on 2026-06-07.

## Active Handoff

- **In progress:** None.
- **Next action:** Create `codex/reliability-foundation` from updated `main`,
  then add Vitest, core domain tests, and `supabase/migrations/`.
- **Blockers:** None.
- **Uncommitted work:** None.

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
- `supabase/schema.sql` is the only tracked schema source.

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
- There is no automated test suite.

## Repository Notes

- `main` tracks `origin/main`.
- Use focused `codex/...` branches for implementation work.
- Pull requests are required for database migrations, broad refactors, and
  other high-risk changes. Low-risk and documentation-only work may be
  committed directly to `main`.
- `.env.local`, `.codex/`, and `recipe-export.json` are local-only.
- GitHub CLI and Supabase CLI are not currently installed. Pull requests are
  opened in GitHub's web interface, and migrations are applied through the
  Supabase SQL editor.
