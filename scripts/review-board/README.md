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

## Caveats

- `capture.mjs` requires `playwright-core` (resolved from an npx cache path
  at the top of the file — update it if stale) and a cached Chromium; it
  falls back to system Chrome.
- Never point any of this at prod: the seed writes data and Shop
  regenerates on load. Local stack only.
- `next build` while the dev server runs poisons the shared `.next` with
  `.env.local`'s prod URLs — `rm -rf .next` and restart the dev server
  (see progress-log 2026-07-02).
