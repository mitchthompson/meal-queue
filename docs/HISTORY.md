# History

This is an append-only, decision-rich log. Add the newest entry at the top.
Include outcomes, important tradeoffs, verification, and remaining work.

## 2026-06-11 - Front-End UI Audit and Milestone 5

- Audited all five screens for layout, responsiveness, accessibility, and
  interaction flows; visually verified the unauthenticated screens at desktop
  and iPhone viewports. Full findings: `docs/UI_AUDIT_2026-06-11.md`.
- Top friction: feedback messages render off-screen with no `aria-live`,
  text-button tap targets are below iOS guidance, the mobile recipe editor
  opens without scrolling into view, the plans page buries the week grid, and
  every navigation shows a loading flash with no cached data.
- Owner decisions: feedback overhaul, mobile ergonomics, and loading polish
  become roadmap milestone 5 (after the reliability core, before component
  hardening, which is now milestone 6); accessibility fixes fold into each
  track; auth flow completion is deferred.
- Next work: milestone 2 (atomic recipe saves).

## 2026-06-11 - Reliability Foundation and Audit Merged

- Merged `codex/reliability-foundation` (`7cfbab2`) and
  `codex/code-audit-plan` (`e13f158`) into `main`.
- GitHub CLI is unavailable, so with the owner's approval the reviewed
  branches were merged locally with merge commits instead of web pull
  requests. The audit itself served as the review of the reliability
  foundation diff.
- Verification on merged `main`: `npm run test` (13 passing),
  `npm run typecheck`, and `npm run build` passed.
- Next work: detailed front-end UI audit (owner request), then milestone 2.

## 2026-06-11 - Independent Code Audit and Plan Confirmation

- Audited all application source, the Supabase schema, tests, and the prior
  reliability review. Full findings: `docs/CODE_AUDIT_2026-06-11.md`.
- Confirmed all six previously documented reliability risks as accurate and
  the milestone 2-5 targeting as sound.
- New findings: silent over-triggered grocery regeneration compounds the
  checklist wipe, the dashboard's 4-plan window can hide the current week,
  duplicate settings initialization, and the `mcp/` server was entirely
  untracked.
- Owner decisions: scope is milestones 2-4 in roadmap order, implemented with
  Postgres functions and triggers; remaining findings deferred and recorded in
  `ROADMAP.md`; `mcp/` source brought under version control.
- Verification: `npm run test` (13 passing) and `npm run typecheck` passed.
- Remaining work: merge `codex/reliability-foundation` and
  `codex/code-audit-plan`, then start milestone 2.

## 2026-06-09 - Reliability Foundation Implemented

- Added Vitest with 13 tests covering local date arithmetic, plan defaults,
  ingredient scaling, grocery normalization, exact-match grouping, pantry
  separation, source keys, and rounding.
- Extracted shared domain logic into `lib/date-utils.ts` and `lib/grocery.ts`
  without changing route interfaces.
- Corrected date serialization to use local calendar fields instead of UTC,
  preventing timezone-driven off-by-one dates.
- Established `supabase/migrations/` as a forward-only migration directory
  without creating a false baseline for the live database.
- Upgraded Next.js from `15.2.6` to patched release `15.5.19` and added targeted
  PostCSS and `ws` overrides. `npm audit` reports zero vulnerabilities.
- Verification: `npm run test`, `npm run typecheck`, `npm run build`, internal
  Markdown links, and `git diff --check` passed.
- Remaining work: review, commit, push, and merge the reliability foundation
  branch before starting atomic recipe saves.

## 2026-06-07 - Hybrid Git and Session-Wrap Workflow

- Merged the documentation foundation through PR #1 at commit `0108c44`.
- Decided that pull requests are used for risk management rather than required
  for every change.
- Database migrations, broad refactors, and risky behavior changes retain a
  pull-request review gate.
- Small, low-risk, and documentation-only changes may be committed directly to
  `main` after verification.
- Added a required end-of-session wrap covering Git state, verification,
  current-state handoff, documentation updates, incomplete work, and the exact
  next action.
- Next work: begin the reliability foundation milestone.

## 2026-06-07 - Documentation Foundation Started

- Reviewed the repository, current application flows, Supabase schema, and
  existing project documents.
- Verified local and GitHub `main` both pointed to commit `022e354`.
- Chose a reliability-first roadmap for a personal/household product.
- Chose small reviewed pull requests and additive migrations that preserve live
  Supabase data.
- Established the project-memory documentation structure.
- Verification: internal Markdown links, `git diff --check`,
  `npm run typecheck`, and `npm run build` passed.
- Result: merged through PR #1 at commit `0108c44`.

## 2026-02-15 - Mobile UI Optimization

- Commit: `022e354`.
- Improved mobile navigation and responsive application layouts.
- This is the current baseline for the reliability roadmap.

## 2026-02-14 - Next.js Security Patch

- Commit: `978168c`.
- Updated Next.js in response to CVE-2025-66478.

## 2026-02-14 - Core Workflow Improvements

- Commit: `b3bb3d9`.
- Improved meal-plan, grocery, and recipe UI flows.

## 2026-02-14 - Initial Application

- Commits: `68cc532`, `919b10a`, and earlier repository initialization.
- Established the Next.js and Supabase application with recipes, planning,
  grocery lists, settings, authentication, and row-level security.
