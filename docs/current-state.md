# Current State

Last reviewed: 2026-07-02

Cold-start fast-read for Meal Queue — a single-household meal planner and
grocery generator. Start here, then follow the links into the detailed docs.

## Current build phase

**Reliability core complete → redesign foundation.** Milestones 0–4 and
mini-M5 are shipped and live. The database layer is atomic, race-free, and
state-preserving, proven by 108 pgTAP assertions in CI plus rolled-back live
smoke tests at each prod apply. A **larger redesign is approved and briefed**
([redesign-brief.md](redesign-brief.md)): a reflow around the household's
weekly cycle (Plan → Shop → Cook, with a Today home screen and a full-screen
dark cooking mode), on a calm-utility look with bold treatment where hands are
busy. **Milestone 6 (component hardening) is in progress** on
`codex/component-hardening` as the redesign's foundation. Existing household
data is live and must stay compatible throughout. See [roadmap.md](roadmap.md).

## Stable Baseline

- **`main`:** mini-M5 merged (PR #6, `abbf3b2`, 2026-07-02) and deployed on
  Vercel (merge to `main` auto-deploys — confirmed).
- **Prod database:** all four migrations in `supabase/migrations/` are applied
  and verified (`save_recipe`, Data API grants, plan-integrity triggers,
  grocery state preservation). `supabase/schema.sql` is canonical and in sync;
  the timestamped baseline copy is CI/local-only.
- **CI:** GitHub Actions on every PR — app checks (typecheck / vitest / build)
  and DB tests (ephemeral Supabase stack, 108 pgTAP assertions across three
  suites), CLI pinned 2.109.0, NOTESTS guard. Six PRs merged, six first-try
  green runs.
- **Latest verification:** 2026-07-02 — typecheck clean, vitest 15/15,
  `next build` green (11 routes), pgTAP 108/108 local + CI.
- **Remote:** `origin` = `https://github.com/mitchthompson/meal-queue.git`.
- **Backups:** manual `pg_dump` runbook (libpq 18.4); latest snapshots in
  `~/meal-queue-backup-2026-07-01-*.dump` (98K/113K, 10-table manifests).

## Active Handoff

- **In progress:** Milestone 6 (component hardening) on
  `codex/component-hardening` (pushed), as the redesign foundation.
  **Slice 1 done + merged** (PR #7): shared date formatters →
  `lib/date-utils.ts`. **Slice 2 done, on the branch:** `useGroceryList` data
  hook (`lib/hooks/use-grocery-list.ts`) — the grocery page dropped ~380 → 191
  lines, presentation-only; behavior-neutral, verified. The redesign brief is
  [redesign-brief.md](redesign-brief.md); the approved direction mockups are
  in-repo at [mockups/reflow-v1.html](mockups/reflow-v1.html).
- **Next action:** M6 slice 3 — extract the **plans** data hook
  (`lib/hooks/use-plan.ts`) from `app/plans/page.tsx` (~1,050 lines; the
  hardest one: plan CRUD, slot upserts, leftover linking, quick-add state).
  Follow the `use-grocery-list.ts` pattern: move data logic verbatim,
  behavior-neutral, page keeps presentation. Then slice 4: recipes hook +
  shared components (the ~330-line duplicated lunch/dinner columns). Then PR →
  green CI → owner merge. After M6: the reflow, screen by screen (suggested
  order: Cook, Today, Shop, Plan), per the brief.
- **Blockers:** None.
- **Environment notes:** `.env.local` exists (prod DB access verified,
  PG 17.6); read-only Supabase MCP configured in `.mcp.json` (owner OAuth
  pending first use); `gh` holds both accounts (`2a-webteam` active machine-
  wide, `mitchthompson` pinned per command via
  `GH_TOKEN=$(gh auth token --user mitchthompson)`); local Supabase stack runs
  on Colima (`supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`).

## Page status

Routes confirmed against `app/`. Per-page intent lives in `docs/pages/<slug>.md`
(stubs; the redesign brief supersedes them for future-state intent).

| Page | Route | Status |
| --- | --- | --- |
| Dashboard | `/` (`app/page.tsx`) | Working; known issue — loads items for only the 4 newest plans; slated to become **Today** in the reflow |
| Recipes (list) | `/recipes` (`app/recipes/page.tsx`) | Working; atomic `save_recipe` RPC live |
| Recipe detail | `/recipes/[id]` (`app/recipes/[id]/page.tsx`) | Working; focus mode is the seed of the reflow's Cook mode |
| Plans | `/plans` (`app/plans/page.tsx`) | Working; DB-enforced integrity, trigger-based scoped versioning |
| Grocery | `/grocery` (`app/grocery/page.tsx`) | Working; transactional state-preserving regeneration (checked/on-hand/pantry-override survive) |
| Settings | `/settings` (`app/settings/page.tsx`) | Working; `ensureUserSettings` runs once per sign-in (defaults duplication still open) |

Authentication is email/password through Supabase. The app installs to the
iPhone home screen as a standalone app (manifest + icons + safe-area handling,
mini-M5).

## Milestone status

| # | Milestone | Status |
| --- | --- | --- |
| 0 | Documentation Foundation | Done (PR #1, `0108c44`) |
| 1 | Reliability Foundation | Done (`7cfbab2`, 2026-06-11) |
| 1.5 | CI + Test Harness | Done (PR #3, `240b508`, 2026-07-01) |
| 2 | Atomic Recipe Saves | Done (PR #2 + prod apply, 2026-07-01) |
| 3 | Plan Integrity | Done (PR #4 + prod apply, 2026-07-02) |
| 4 | Grocery State Preservation | Done (PR #5 + prod apply, 2026-07-02) |
| 5 | UI Feedback and Ergonomics | Rescoped — mini-M5 done (PR #6, 2026-07-02); rest folds into the redesign |
| 6 | Component Hardening | **In progress** (`codex/component-hardening`) — redesign foundation |
| — | The Reflow (redesign) | Briefed ([redesign-brief.md](redesign-brief.md)); follows M6 |

## Architecture snapshot

- Next.js 15 App Router + React 19 on Vercel; client components query Supabase
  directly (owner-based RLS, explicit Data API grants).
- Aggregate writes are **database transactions**: `save_recipe`,
  `regenerate_grocery_list`, and plan-integrity triggers (scoped version
  bumps, cross-row validation with row locks). The browser no longer
  orchestrates multi-request writes.
- Plain CSS design-token system in `app/globals.css` (no Tailwind);
  `lib/design-tokens.ts` mirrors the few values TS needs (manifest, viewport).
- Tests: vitest for `lib/` domain logic (15); pgTAP for the database layer
  (108 across three suites) on an ephemeral local/CI stack.
- `supabase/schema.sql` canonical; forward-only migrations in
  `supabase/migrations/`; prod applies by hand (runbook: backup → preflight →
  apply → verify → rolled-back smoke), **migration before dependent client
  merge**.

## Open issues

- Dashboard loads items for only the 4 newest plans (fix lands with Today in
  the reflow).
- Default settings values duplicated across client files vs SQL defaults
  (M6 target).
- No route-level `error.tsx` / `loading.tsx` boundaries; unmapped errors still
  surface raw messages (mini-M5 added friendly mapping + `aria-live`).
- `npm run lint` non-functional (no ESLint config) — tracked follow-up.
- `npm audit`: 1 high-severity finding (root), 9 in `mcp/` — triage pending.
- Full register: [design-flags.md](design-flags.md).

## Where to go next

- Redesign intent — [redesign-brief.md](redesign-brief.md)
- Milestones and deferred work — [roadmap.md](roadmap.md)
- Verification and runbooks — [qa.md](qa.md), [architecture.md](architecture.md)
- Data model — [data-model.md](data-model.md) (canonical: `supabase/schema.sql`)
- Decisions and history — [decisions.md](decisions.md), [progress-log.md](progress-log.md)
