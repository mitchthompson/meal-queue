# Meal Queue

Single-household meal planning and grocery generation. Optimized for personal/household use; no multi-user, sharing, or public-product features. Primary targets: desktop browsers and iPhone Safari.

## Start here, every session

**Run the `/onboard` skill** (`.claude/skills/onboard/`) — it reads the canon,
verifies repo/CI/env reality against the docs, runs a fast health baseline, and
proposes the next action for approval. If skills are unavailable, do the same
by hand: read [docs/current-state.md](docs/current-state.md) first — it is the
always-current handoff (build phase, status, known risks, next concrete
action) — then [docs/roadmap.md](docs/roadmap.md) for approved upcoming work.
Do this before touching anything.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Supabase** (Postgres + Auth), accessed from client components via the browser `supabase-js` client; owner-based Row-Level Security
- **Plain CSS** with a CSS-variable design-token system in `app/globals.css` (NO Tailwind); `clsx` for class composition
- **Zod** for validation
- **Vitest** for unit tests (domain logic in `lib/`)
- Hosted on **Vercel**
- `mcp/` — a separate recipe-import MCP server (its own package); out of scope unless a task names it

## Conventions

### CSS tokens / namespace

No CSS class prefix is used — this is a single self-contained app, nothing else shares the DOM. The CSS-variable token system in `app/globals.css` **is** the namespace.

- All color/spacing/typography flows through the `--color-*` variables and their semantic aliases (`--bg`, `--surface`, `--ink`, `--muted`, `--brand`, `--brand-2`, `--line`, etc.).
- **NEVER hardcode** a hex value, font, or magic spacing number in a component. If a needed token is missing, add it to `app/globals.css` and document it in [docs/design-system.md](docs/design-system.md), or flag it in [docs/design-flags.md](docs/design-flags.md) — never inline a one-off value.

### Design source of truth

There is no external design tool (no Figma). The source of truth is in-repo and authoritative:

- **Data truth:** `supabase/schema.sql` (canonical full schema) and [docs/data-model.md](docs/data-model.md) (derived, human-readable).
- **UI truth:** the tokens in `app/globals.css` + [docs/design-system.md](docs/design-system.md).
- **Per-page intent:** `docs/pages/<slug>.md`.

Always confirm against these live files before building. Do **not** trust a planning doc's restatement of a value — read the schema/token/page source and use confirmed values only. A missing value is flagged in [docs/design-flags.md](docs/design-flags.md), never invented.

### Build order for any unit of work

1. **Understand the spec/schema first** — read [docs/data-model.md](docs/data-model.md) + `supabase/schema.sql` for data work; [docs/design-system.md](docs/design-system.md) + the relevant `docs/pages/<slug>.md` for UI work.
2. **Pull the authoritative design/context** — the actual tokens, schema columns, route, and page intent. Confirm the live values; do not rely on a planning doc's paraphrase.
3. **Implement with confirmed values only.** If a needed value is missing, flag it in [docs/design-flags.md](docs/design-flags.md) rather than inventing it.
4. **Seed/run it** — `npm run dev` for UI, or run the relevant query/test for logic.
5. **Verify against the source** — compare output to the schema/tokens/page spec and run `npm run lint`, `npm run typecheck`, `npm run test`.
6. **Commit after approval** (Conventional Commits, no Co-Authored-By).

## Anti-goals (never do without asking)

- Touch live Supabase data, or run/apply any database migration, without explicit approval. (Existing data is live household data.)
- Change the database schema (`supabase/schema.sql` or `supabase/migrations/`) without approval.
- Install or upgrade any dependency without approval.
- Commit or push without explicit approval. The orchestrator commits only after approval; sub-agents NEVER commit. Pushing to `main` deploys to Vercel — treat a push as a release that needs approval.
- Add multi-user, sharing, or public-product features, or any auth flow beyond the existing email/password (this is a single-household app).
- Hardcode design values (hex, fonts, spacing) instead of using the CSS-variable tokens.
- Guess a schema column, default, or data value. Confirm against `supabase/schema.sql` or flag it in [docs/design-flags.md](docs/design-flags.md).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server (`next dev`) |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Serve the production build |
| `npm run lint` | `next lint` |
| `npm run test` | `vitest run` (one-shot) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |

**Run at session end:** `npm run lint`, `npm run typecheck`, `npm run test` (also run `npm run build` when shipping a build-affecting change).

## Git rules

- **Conventional Commits** style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- **NEVER** add a `Co-Authored-By` trailer to any commit.
- Orchestrator commits only after explicit user approval. Sub-agents never commit.
- Implementation work uses focused `codex/...` feature branches. Pull requests are a risk tool — required for DB migrations, broad refactors, and risky behavior changes; low-risk and docs-only work may go directly to `main` after review + verification.
- Pushing to `main` deploys to Vercel — a push is a release action and needs approval.

## End-of-session checklist

**Run the `/wrap` skill** (`.claude/skills/wrap/`) — it executes this checklist
(session inventory, doc updates with an anti-rot sweep, verification, proposed
commits awaiting approval). The manual steps it encodes:

1. Update [docs/current-state.md](docs/current-state.md) (build phase, status tables, known risks, next concrete action).
2. Add a dated entry to [docs/progress-log.md](docs/progress-log.md) (what was done, key decisions, flags raised).
3. Update any other affected docs ([roadmap](docs/roadmap.md), [decisions](docs/decisions.md), [design-flags](docs/design-flags.md), [architecture](docs/architecture.md), [data-model](docs/data-model.md), `docs/pages/*`).
4. Run `npm run lint`, `npm run typecheck`, `npm run test` (and `npm run build` if the change affects the build).
5. Ask the user for commit approval.
6. Commit with a Conventional Commit message and NO `Co-Authored-By` trailer.

## Required reading by task type

| Task | Read first |
| --- | --- |
| Every session start | [docs/current-state.md](docs/current-state.md) (then [docs/roadmap.md](docs/roadmap.md)) |
| DB / schema / migration | [docs/data-model.md](docs/data-model.md), `supabase/schema.sql`, [docs/architecture.md](docs/architecture.md) (deploy & ops), [docs/decisions.md](docs/decisions.md) |
| New page / route | [docs/routes.md](docs/routes.md), `docs/pages/<slug>.md`, [docs/design-system.md](docs/design-system.md) |
| UI / component / styling | [docs/design-system.md](docs/design-system.md), `docs/pages/<slug>.md`, `app/globals.css` |
| Recipe-save / grocery logic | [docs/data-model.md](docs/data-model.md), [docs/architecture.md](docs/architecture.md), `lib/grocery.ts`, [docs/roadmap.md](docs/roadmap.md) (milestones 2–4) |
| MCP / recipe import | [docs/architecture.md](docs/architecture.md) (MCP boundary), `mcp/` |
| Planning / scoping | [docs/roadmap.md](docs/roadmap.md), [docs/decisions.md](docs/decisions.md), [docs/design-flags.md](docs/design-flags.md) |
| Deploy / release | [docs/architecture.md](docs/architecture.md) (deploy), [docs/qa.md](docs/qa.md) |
| Open questions / missing values | [docs/design-flags.md](docs/design-flags.md) |

## Docs map

See [docs/README.md](docs/README.md) for the full documentation index. New
machine? See [docs/setup.md](docs/setup.md) for local dev + Claude Code setup.
