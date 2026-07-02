---
name: onboard
description: Start-of-session ritual for Meal Queue. Use when a session begins, when the user says /onboard, "get up to speed", "pick up where we left off", or asks to continue project work. Reads the project canon, verifies repo/CI/env reality against the docs, runs a fast health baseline, and proposes the next action for approval.
---

# Onboard — start-of-session ritual

Goal: be ready to work in one pass — grounded in the docs, verified against
reality, baseline green — then **propose, don't start**. End by asking for the
go-ahead.

All paths are relative to the repo root: `/Users/mitchell/Dev/meal-queue/meal-queue`
(NOTE: the repo is nested one level below the shell's default cwd — `cd` there
explicitly in every command; background shells can silently reset cwd).

## 1. Read the canon (in this order)

1. `docs/current-state.md` — phase, baseline, Active Handoff (the "next action" lives here)
2. `docs/roadmap.md` — the milestone the next action belongs to
3. `docs/redesign-brief.md` — if the next action is UI/reflow work
4. Skim `docs/decisions.md` + `docs/design-flags.md` — constraints and open questions relevant to the next action

## 2. Verify reality against the docs (docs rot — trust but verify)

```bash
cd /Users/mitchell/Dev/meal-queue/meal-queue
git fetch origin && git status && git log --oneline -5
GH_TOKEN=$(gh auth token --user mitchthompson) gh pr list -R mitchthompson/meal-queue
GH_TOKEN=$(gh auth token --user mitchthompson) gh run list -R mitchthompson/meal-queue --limit 3
```

- Does the branch/PR/CI state match what current-state.md claims? **Flag any
  drift in your report instead of silently inheriting it.**
- Uncommitted or unpushed work left behind? Say so before proposing anything.

## 3. Fast health baseline (~20s; no build, no pgTAP at onboard)

```bash
test -d node_modules || echo "RUN: npm ci (ask first — dependency rule)"
grep -oE '^[A-Z_]+' .env.local || echo ".env.local MISSING (see docs/setup.md; never guess values)"
npm run typecheck && npm run test
```

`npm run lint` is non-functional (no ESLint config — known flag; do not "fix"
it in passing). `next build` and `supabase test db` are for pre-PR
verification, not onboarding.

## 4. Environment cheat sheet (hard-won — believe it)

- **gh accounts:** `2a-webteam` is active machine-wide; act as the repo owner
  per-command: `GH_TOKEN=$(gh auth token --user mitchthompson) gh ...`
- **Local DB stack (Colima):**
  `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`
  (the `vector` exclude works around a Colima docker.sock mount bug); tests:
  `supabase test db`; fresh DB from migrations: `supabase db reset`
- **Prod DB (read-only unless the owner says "apply"):**
  `psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"` with
  `/opt/homebrew/opt/libpq/bin/psql`; a read-only Supabase MCP may also be
  configured
- **RTK proxy** wraps shell commands and can swallow grep/diff detail — rerun
  as `rtk proxy <cmd>` when output looks truncated

## 5. Rules that gate everything (from CLAUDE.md — non-negotiable)

- No commit, push, merge, dependency change, schema change, or live-data write
  without the owner's explicit word. Approval never carries over.
- Merging to `main` deploys to Vercel. DB rituals: green CI → owner says
  "apply" (backup → preflight → apply → verify → rolled-back smoke) →
  **migration before dependent client merge** → owner says "merge".
- Design values only via the tokens in `app/globals.css`; schema truth only
  via `supabase/schema.sql`; missing values go to `docs/design-flags.md`,
  never invented.

## 6. Report (SITREP), then stop

Deliver compactly: **phase · branch/PR/CI state · baseline results · doc-drift
found · proposed next action (from Active Handoff, adjusted for reality) ·
open flags that touch it**. Then ask for the go-ahead. Do not write code,
SQL, or docs before the owner answers.
