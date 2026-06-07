# History

This is an append-only, decision-rich log. Add the newest entry at the top.
Include outcomes, important tradeoffs, verification, and remaining work.

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
