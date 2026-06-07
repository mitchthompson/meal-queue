# Current State

Last reviewed: 2026-06-07

## Session Handoff

- **Last completed work:** Mobile UI optimization on commit `022e354`.
- **In progress:** Documentation foundation on branch
  `codex/docs-foundation`.
- **Next action:** Review and merge the documentation foundation, then begin
  `codex/reliability-foundation`.
- **Blockers:** None.
- **Remote:** `origin` points to
  `https://github.com/mitchthompson/meal-queue.git`.
- **Database status:** Existing Supabase data is treated as live. The repository
  currently has a canonical schema file but no ordered migration directory.
- **Latest verification:** `npm run typecheck` and `npm run build` passed on
  2026-06-07 for this documentation branch.

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
- Use small `codex/...` branches and pull requests.
- `.env.local`, `.codex/`, and `recipe-export.json` are local-only.
- GitHub CLI and Supabase CLI are not currently installed. Pull requests are
  opened in GitHub's web interface, and migrations are applied through the
  Supabase SQL editor.
