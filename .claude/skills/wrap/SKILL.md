---
name: wrap
description: End-of-session ritual for Meal Queue. Use when the user says /wrap, "wrap up", "let's wrap", "end the session", or asks to close out work. Inventories what the session accomplished, updates the handoff docs (with an anti-rot sweep), runs verification, proposes commits, and waits for the owner's word before committing/pushing.
---

# Wrap — end-of-session ritual

Goal: the next session (any agent, any machine) resumes from the repo alone.
Policy: **propose, then one word** — stage and present the commit plan; commit
on "commit", push on "push"/"merge". Never push `main` without the word (it
deploys to Vercel).

Repo root: `/Users/mitchell/Dev/meal-queue/meal-queue` (nested — `cd`
explicitly; background shells reset cwd).

## 1. Inventory the session

```bash
cd /Users/mitchell/Dev/meal-queue/meal-queue
git status && git log --oneline origin/main..HEAD && git log --oneline -10
GH_TOKEN=$(gh auth token --user mitchthompson) gh pr list -R mitchthompson/meal-queue --state all --limit 5
```

Collect: PRs opened/merged · migrations applied to prod (and their verification)
· decisions made · flags raised or resolved · anything started but unfinished.

## 2. Update the handoff docs

- **`docs/current-state.md`** — the cold-start doc. Update the phase paragraph,
  Stable Baseline, Active Handoff (**"Next action" must name the exact file,
  branch, and pattern to follow** — write it as instructions to a stranger),
  milestone table, environment notes.
- **`docs/progress-log.md`** — dated entry, newest on top: outcomes, key
  decisions with the *why*, verification results (**failures included,
  verbatim**), remaining work.
- As touched: `docs/roadmap.md` (milestone statuses), `docs/decisions.md`
  (durable choices, dated), `docs/design-flags.md` (move resolved flags to
  Resolved with date + resolution; add new ones), `docs/redesign-brief.md`
  (owner feedback on the reflow).

### Anti-rot sweep (the failure mode that actually happened)

Incremental patching rots the untouched sections. Before finishing, re-read
**all of** `current-state.md` and check: Stable Baseline still true? Page
status table? Milestone table (no duplicate/contradictory rows)? Open issues
all still open? "Last reviewed" date bumped? Fix everything stale, not just
the section you came to edit.

## 3. Verify and record honestly

```bash
npm run typecheck && npm run test
# if the change can affect the build:
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
# if the DB layer was touched (stack must be up):
supabase db reset && supabase test db
```

Results go in the progress-log entry as they happened. A red result is
reported, never hidden and never "fixed" by weakening a test.

## 4. Leave-behind sweep

- Uncommitted files? Unpushed branches? (`git status`, `git log @{u}..`)
- **Scratchpad artifacts worth preserving?** Mockups, generated assets, useful
  scripts — commit them under `docs/` (scratchpads evaporate with the session).
- Docs drift between the working branch and `main`? Note in the report where
  the freshest docs live.
- In-flight PR? Note its state and what unblocks it.

## 5. Propose commits, await the word

- Conventional Commits (`feat:` `fix:` `refactor:` `docs:` `test:` `chore:`),
  grouped logically (implementation ≠ docs), **NEVER a `Co-Authored-By` or any
  AI-attribution trailer**.
- Present: files per commit + messages. Commit on the owner's word; push
  branches on "push". `main` merges/pushes always get their own explicit word.

## 6. Close with the handoff line

End the final message with the exact kickoff for next time (also mirrored in
current-state.md's Next action), e.g.:

> Next session: `/onboard`, then continue <milestone> on `<branch>` — next step
> is <one concrete sentence>.
