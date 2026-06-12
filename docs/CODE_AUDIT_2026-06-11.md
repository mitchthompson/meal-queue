# Code Audit - 2026-06-11

Independent audit of the application code, database schema, tests, and the
previously documented reliability review. Conducted on
`codex/reliability-foundation` (commit `0246e9e`). Verification at audit time:
`npm run test` (13 passing) and `npm run typecheck` both passed.

## Scope and Method

- Read every application source file: route components, shared components,
  `lib/` domain modules, and their tests.
- Read `supabase/schema.sql` in full, including constraints, triggers, and
  row-level-security policies.
- Read the untracked `mcp/` recipe-import server source.
- Cross-checked each risk documented in `CURRENT_STATE.md` and each planned
  milestone in `ROADMAP.md` against the actual code.

## Verdict on the Prior Review

All six risks documented in `CURRENT_STATE.md` are real, accurately described,
and correctly targeted by roadmap milestones 2-5:

1. **Non-atomic recipe saves** (`app/recipes/page.tsx`, `saveRecipe`): the
   client deletes all ingredients, steps, and tag links in a `Promise.all`,
   then re-inserts. A failure between delete and insert strips the recipe of
   its children. Form state survives in memory only.
2. **Grocery regeneration wipes user state** (`app/grocery/page.tsx`,
   `regenerateForPlan`): delete-all-then-insert resets checked, on-hand, and
   pantry-override flags.
3. **Lost version increments** (`app/plans/page.tsx`, `bumpPlanVersion`):
   client-side read-then-write; concurrent mutations can lose increments.
4. **Missing database constraints**: nothing enforces `plan_date` within the
   plan range, leftover links pointing at cook items, or same-owner recipe
   references.
5. **Recipe ingredient edits never invalidate grocery lists**: no version bump
   occurs when a recipe changes.
6. **Oversized route components**: `app/plans/page.tsx` is ~1,100 lines; the
   lunch and dinner columns are near-exact duplicates.

## New Findings

### Severity: notable

- **Silent, over-triggered grocery regeneration compounds the state wipe.**
  Every plan mutation bumps the version, including changes with no grocery
  effect (eating-out notes, leftover servings). The grocery page detects the
  stale version on load and regenerates silently
  (`app/grocery/page.tsx`, `loadGroceryItems`), so a minor plan tweak wipes the
  shopping checklist without any user action. Milestone 4 (state preservation)
  fixes the symptom; reducing when regeneration happens is recorded as a
  deferred improvement.
- **Dashboard can show an empty current week** (`app/page.tsx`,
  `loadDashboard`): meal items and grocery previews load only for the 4 plans
  with the newest `start_date`. With 4 or more future plans, the current plan
  falls outside that window and the dashboard silently shows nothing.

### Severity: minor

- **Five sequential round trips per plan mutation** (insert, version read,
  version write, item reload, plan reload) make planning sluggish on iPhone
  Safari, a primary target. Milestone 3's trigger-based versioning removes two
  of these; optimistic updates are deferred.
- **`ensureUserSettings` runs twice per sign-in**
  (`components/auth-gate.tsx`): once after the auth call and once from the
  session effect. Default settings values are also duplicated in three files
  and disagree with the SQL defaults (DB: null order/pickup weekdays; client:
  3/4).
- **Raw Supabase error strings render directly in the UI**, and no route-level
  error or loading boundaries exist.
- **`supabase/schema.sql` mixes baseline DDL with historical inline `ALTER`
  migrations**, which makes the canonical schema harder to read.

### Repository and tooling

- **The entire `mcp/` recipe-import server was untracked** (`.gitignore`
  excluded `mcp/` wholesale): no version history or review trail for code that
  writes to the live database. Resolved with this audit: `mcp/` source is now
  tracked; `.mcp.json` and build output remain ignored.
- The MCP `save-recipe` tool uses the same non-atomic insert sequence as the
  app and runs with the service-role key (bypasses row-level security by
  design). It should adopt the milestone 2 `save_recipe` function when that
  lands.

### Security posture (no action required)

- Row-level security covers every table with correct owner policies.
- `.env.local` and `.mcp.json` (service-role key) are untracked.
- Next.js is patched (`15.5.19`); npm audit was clean at last verification.

## Decisions Confirmed with the Owner (2026-06-11)

1. **Scope**: the finalized plan covers the reliability core (milestones 2-4)
   only. Quick-win fixes, grocery-staleness redesign, and the component
   refactor stay deferred and are recorded in `ROADMAP.md`.
2. **Sequencing**: follow the existing roadmap order (M2 atomic recipe saves,
   M3 plan integrity, M4 grocery state preservation).
3. **Implementation approach**: Postgres functions (RPCs) and triggers for
   true transactional guarantees, applied as forward-only migrations through
   the Supabase SQL editor.
4. **MCP server**: track `mcp/` source in Git, keeping secrets ignored.

The finalized milestone details live in `ROADMAP.md`. Deferred findings from
this audit are listed there so they are not lost.
