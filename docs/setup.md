# Setup — Dev on a New Machine with Claude Code

How to get Meal Queue running for development on a fresh machine, and how to
start a Claude Code session against it. For ongoing work, the entry points are
[`CLAUDE.md`](../CLAUDE.md) (repo root, auto-loaded) and
[`current-state.md`](current-state.md).

## Prerequisites

- **Git**.
- **Node.js 20 LTS** and npm (Next.js 15 requires Node ≥ 18.18; 20 LTS is the
  safe default). There is no version pin in the repo.
- **Claude Code** CLI: `npm install -g @anthropic-ai/claude-code` (or the
  current install method from Anthropic's docs). Optionally the VS Code /
  JetBrains extension.
- **Access to the Supabase project** — you need the project URL and anon key
  (below). The database holds **live household data**.

## 1. Clone

```bash
git clone https://github.com/mitchthompson/meal-queue.git
cd meal-queue
```

## 2. Install dependencies

```bash
npm install
```

## 3. Environment variables

The app reads two public Supabase values (see
[`lib/supabase/client.ts`](../lib/supabase/client.ts)). Copy the template and
fill it in:

```bash
cp .env.example .env.local
```

```ini
NEXT_PUBLIC_SUPABASE_URL=        # Supabase dashboard → Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # same page → Project API keys → anon / public
```

- `.env.local` is **gitignored** and never committed — recreate it per machine.
- If either value is missing, the app throws `Missing Supabase env vars.` on
  startup.
- ⚠️ This connects to the **live** household database. Reads/writes are
  owner-scoped by Row-Level Security. Treat the data as production — see the
  anti-goals in [`CLAUDE.md`](../CLAUDE.md).

## 4. Run

```bash
npm run dev      # http://localhost:3000
```

Sign in with the existing email/password account (this is a single-household
app; there is no public sign-up flow to rely on).

## 5. Verify the baseline

```bash
npm run lint
npm run typecheck
npm run test      # unit tests for lib/ domain logic (13 as of the last run)
npm run build     # run when a change can affect the build
```

If these pass, the environment is good. See [`qa.md`](qa.md) for the
per-change-type acceptance checklists.

## Claude Code on this machine

- [`CLAUDE.md`](../CLAUDE.md) at the repo root auto-loads as project
  instructions. Every session starts by reading
  [`current-state.md`](current-state.md), then [`roadmap.md`](roadmap.md).
- The **`.claude/` folder is gitignored** — Claude Code settings, any MCP
  config, and git worktrees do **not** travel with the repo. Recreate
  per-machine settings as needed.
- Use the kickoff prompt below to start your first session.

## Optional — the recipe-import MCP server (`mcp/`)

Only needed if you are working on recipe import; it is out of scope for normal
web-app work (see the MCP boundary in [`architecture.md`](architecture.md)).

```bash
cd mcp
npm install
npm run build      # tsc; `npm run dev` watches
```

- It is a separate package (`meal-planner-mcp`) with its own `node_modules`.
- It is wired up via a root `.mcp.json`, which is **gitignored** because it
  holds secrets — including a Supabase **service-role** key (the MCP path
  bypasses RLS by design). You must recreate `.mcp.json` on the new machine; it
  is not in git.

## Git & workflow reminders

Full rules are in [`CLAUDE.md`](../CLAUDE.md); the essentials:

- **Conventional Commits**; never add a `Co-Authored-By` trailer.
- Implementation work uses focused `codex/...` branches. Pull requests are
  required for DB migrations, broad refactors, and risky behavior changes;
  docs-only and low-risk work may go directly to `main` after review.
- **Pushing to `main` deploys to Vercel** — treat a push as a release that
  needs approval. (Confirm the exact deploy trigger — it is an open item in
  [`design-flags.md`](design-flags.md).)
- Database migrations are applied **by hand through the Supabase SQL editor**
  (no Supabase CLI installed); additive-only, against live data. See
  [`qa.md`](qa.md) and [`architecture.md`](architecture.md).

## First Claude Code session — kickoff prompt

Paste this into Claude Code after the steps above:

```text
You are my coding collaborator (the "orchestrator") for Meal Queue — a
single-household Next.js 15 + React 19 + Supabase meal-planning and grocery app.

Before doing anything else:
1. Read CLAUDE.md, then docs/current-state.md, then docs/roadmap.md. Skim
   docs/decisions.md and docs/architecture.md so you understand the working
   method and constraints.
2. Confirm the local setup works: run `npm run lint`, `npm run typecheck`, and
   `npm run test`, and report the results. If `.env.local` is missing or Supabase
   env vars aren't found, tell me how to fix it (see docs/setup.md) — do NOT
   guess values.

Then, before writing any code:
- Summarize the current build phase, the next planned milestone, and any open
  risks/flags (from docs/current-state.md and docs/design-flags.md).
- Propose a concrete plan for the next milestone and wait for my go-ahead.

Operating rules (from CLAUDE.md — follow exactly):
- Never commit or push without my explicit approval; pushing to main deploys to Vercel.
- Never change the DB schema, run/apply a migration, or touch live Supabase data
  without approval. Never install or upgrade dependencies without approval.
- No multi-user/sharing/public-product features; no auth flow beyond the existing
  email/password.
- Never hardcode design values — use the CSS-variable tokens in app/globals.css
  (see docs/design-system.md). Never guess a schema column or value — confirm
  against supabase/schema.sql or flag it in docs/design-flags.md.
- Build order: understand the spec/schema → pull the authoritative tokens/columns →
  implement with confirmed values only → run it → verify against source → commit
  only after my approval.

Identify the current milestone and next concrete action from
docs/current-state.md (do not assume it from this prompt), and confirm with me
before starting.
```
