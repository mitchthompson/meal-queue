# Review-board toolkit

Captures pinned screenshots of the running app and assembles them into a
self-contained HTML review board (used for the 2026-07-02 reflow review;
progress-log has the full story). Reuse for the v2 sweep and future rounds.

## Flow

1. Start the local stack (`supabase start -x vector,...`) and a dev server
   pointed at it (inline `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` env, port
   3123 — or edit `BASE` in `capture.mjs`).
2. `node capture.mjs` — signs up `reviewer@local.test`, seeds
   `seed-review.sql` via psql (idempotent; local DB only), drives every
   screen, writes `shots/*.jpg` + `shots/manifest.json` with pin
   bounding-boxes. Edit the shot/pin lists per round.
3. `node gen-board.mjs` — inlines the shots as base64 into
   `review-board.html` (photos + amber decision pins + flag cards).

## Round 2 (v2 sweep) additions

- `verify-v2-sweep.mjs` — drives Settings / recipes list / editor takeover /
  recipe detail at 390px and asserts the token-swap computed styles
  (22 assertions + a full-DOM retired-value scan). Template for any
  "did the CSS change take?" verification.
- `capture-settings-variants.mjs` — CSS-injected direction mocks + labeled
  "before" reconstructions, captured on the live local app. Template for
  the mocks-first step of each per-screen pass (edit the CSS blocks).
- `verify-settings-pass.mjs` — layout assertions + a **live save
  round-trip** for the Settings v2 pass. Template for behavior-neutral
  verification of the remaining passes.
- `gen-board-r2.mjs` — the round-2 board generator (reads `shots-v2/`);
  round-2 replaced the round-1 board **in place** at the same artifact URL
  (see the agent memory / progress-log) — always redeploy, never mint a
  new link.
- All scripts sign in as `reviewer@local.test` (sign-in first, sign-up
  fallback) and hard-block requests to `*.supabase.co` at the browser level.
- Generated outputs (`shots*/`, `review-board*.html`) are gitignored.

## Rounds 3–4 (v2 sweep back half) additions

- `capture-recipes-variants.mjs` / `capture-detail-variants.mjs` — the
  round-3 (Recipes library + editor) and round-4 (recipe detail) direction
  mocks; same pattern as the Settings variants.
- `verify-recipes-pass.mjs` / `verify-detail-pass.mjs` — layout assertions
  + behavior round-trips (live `save_recipe` save; Cook takeover, stepper
  rescale, `?cook=1` deep link) + as-built shots.
- `gen-board-r3.mjs` / `gen-board-r4.mjs` — the round boards; r4 is the
  final milestone-7 record (all rounds' pins resolved). Boards deploy in
  place to the same artifact URL — always redeploy, never mint a new link.

## Caveats

- `capture.mjs` requires `playwright-core` (resolved from an npx cache path
  at the top of the file — update it if stale) and a cached Chromium; it
  falls back to system Chrome.
- Never point any of this at prod: the seed writes data and Shop
  regenerates on load. Local stack only.
- `next build` while the dev server runs poisons the shared `.next` with
  `.env.local`'s prod URLs — `rm -rf .next` and restart the dev server
  (see progress-log 2026-07-02).
