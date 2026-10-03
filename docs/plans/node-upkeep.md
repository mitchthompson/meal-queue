# Milestone 19: Upkeep, Node and platform (build spec for handoff)

**Status (2026-10-03): builder-ready.** Drafted against `main` at `0a66ec8`.
Branch `codex/node-upkeep`. One small PR. Zero app-code change, zero new
dependencies, zero schema change.

**Audience:** a builder model. Follow it literally. Where it says STOP, stop
and report to the orchestrator. The builder never commits, never edits
`docs/`, and never touches prod.

---

## 1. Context (why)

- **CI** runs `actions/setup-node@v5` with `node-version: 20`
  (`.github/workflows/ci.yml`, app-checks job). Node 20 reached end of life on
  2026-04-30.
- **`@supabase/*`** packages now declare Node >= 22; CI prints engine warnings
  only.
- **Vercel:** nothing in the repo pins the Node version (no `engines`, no
  `vercel.json`), so the dashboard's Project Settings > Node.js Version
  decides. Vercel's build-utils marks **20.x discontinued from 2026-10-01**
  and offers 24.x and 22.x. Deploys still succeeded on 2026-10-02 (PR #40), so
  the dashboard is on 22.x or 24.x; which one isn't recorded anywhere in the
  repo.
- **Node 24** is the current Active LTS, maintained until April 2028. Node 26
  becomes LTS in late October 2026 and Vercel doesn't offer it yet.

## 2. Decisions (locked by this spec)

| # | Decision | Why |
|---|---|---|
| N1 | Pin `"engines": { "node": "24.x" }` in `package.json`. | Vercel resolves the Node version from `engines.node` **first**, ahead of the dashboard setting (it logs a warning when the two differ). The pin lives in git, so it shows up in review and can be reverted. |
| N2 | CI reads the same pin: `node-version-file: package.json` replaces `node-version: 20`. | `actions/setup-node` resolves `package.json` as `volta.node`, then `devEngines.runtime`, then `engines.node`; `24.x` resolves to the newest 24 release. One source of truth for CI and Vercel. |
| N3 | `24.x`, not `>=22` or `>=24`. | Vercel picks the first supported major that satisfies the range, so an open range would jump to 26.x as soon as Vercel adds it, without review. `24.x` floats only within the major, so it still gets security patches. |
| N4 | `@types/node` stays `^22`. | The 22 type definitions are a subset of what 24 provides. Bumping them is a dependency change; it's an optional follow-up. |
| N5 | No `.nvmrc`, no `vercel.json`. | Neither is needed once `engines` is set. Local development keeps whatever Node the machine has (26.x here). |
| N6 | `mcp/` is untouched. | It's a separate package that neither CI nor Vercel builds. |
| N7 | Next.js 16 stays a separate, later decision. | 15.5.x still gets security fixes (roadmap M19). |

## 3. Builder steps

Repo root: the canonical checkout is `/Users/mitchell/Dev/meal-queue/meal-queue`.
The orchestrator may point you at a worktree instead; if so, work only there.

1. **Baseline:** `npm run typecheck && npm run test && npm run lint`, then
   `npm run build` with the CI placeholders
   (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`).
   Record the vitest count and the static page count (13 at `0a66ec8`).
2. **`package.json`:** add a top-level `"engines": { "node": "24.x" }` block
   directly after `"private": true`. Change nothing else.
3. **`package-lock.json`:** run `npm install --package-lock-only --ignore-scripts`.
   Then `rtk proxy git diff --stat package-lock.json` and
   `rtk proxy git diff package-lock.json`. Keep the result **only if** the
   sole change is the root package entry (`packages[""]`) gaining the same
   `engines` block. If anything else moved (a version, `resolved`, `integrity`,
   peer flags, the lockfile version), run `git checkout package-lock.json` and
   report what changed instead; `npm ci` doesn't need the root `engines` to
   match.
4. **`.github/workflows/ci.yml`:** in the app-checks job's
   `actions/setup-node@v5` step, replace `node-version: 20` with
   `node-version-file: package.json`. Keep `cache: npm`. Change nothing else
   in the file (the db-tests job doesn't use Node).
5. **Gate again:** the step 1 commands, including the build. Report any
   `EBADENGINE` or engine warnings you see (expected on a non-24 local Node;
   informational only).
6. **STOP:** hand back `git status --short`, `git diff`, and both gate results.

## 4. Orchestrator verification (after commit and push)

- The PR's CI app-checks job: the "Setup Node" step log resolves a
  `v24.x` version, and every step is green. db-tests is unaffected and must be
  green too.
- The Vercel preview check on the PR succeeds. With `engines` pinned, an
  unsupported value would fail the build (`BUILD_UTILS_NODE_VERSION_INVALID`),
  so a green preview means 24.x was used. The owner can confirm in the build
  log ("Node.js Version: 24.x").
- After the owner's merge (it deploys prod on the new runtime): prod probes
  `/`, `/grocery`, `/recipes`, `/plans` return 200, and
  `POST /api/import-recipe` with an empty body returns 400 (the one serverless
  function runs on the Node 24 runtime).

## 5. Rollback

Revert the commit. Vercel falls back to the dashboard setting (22.x or 24.x)
and CI goes back to its explicit version.

## 6. Owner gates and optional follow-ups

- **Merge** (a production release: the runtime changes).
- Optional, dashboard: set Project Settings > Node.js Version to 24.x so
  Vercel's mismatch warning goes away. The pin works without it.
- Optional, later: `@types/node` to `^24` (a dependency change).

## 7. Docs on wrap (orchestrator only)

`docs/current-state.md` (the Node lines in Stable Baseline and Open issues),
`docs/architecture.md` (Setup & Environment: Node 24 via `engines`),
`docs/roadmap.md` (M19 status), `docs/decisions.md` (N1 to N3 in brief),
`docs/progress-log.md`.
