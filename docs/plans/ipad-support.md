# Plan: iPad coherence

Status: **proposed** (awaiting go-ahead) · Drafted 2026-07-03 · Scope chosen by owner: **"make it coherent"** — a CSS-tier fix, **no new layouts, no review-board round**.

## Problem

The app is scoped to "desktop browsers and iPhone Safari" (CLAUDE.md); iPad was
never a target. The CSS in `app/globals.css` is **desktop-first with two
`max-width` overrides** (900px, 700px — see [design-system.md](../design-system.md#breakpoints)),
so iPad falls through the cracks:

| iPad (portrait) | CSS width | Today it gets |
| --- | --- | --- |
| Mini | 744px | 700–900 hybrid band |
| 10th-gen / Air | 820px | 700–900 hybrid band |
| Pro 11" | 834px | 700–900 hybrid band |
| Pro 12.9" | 1024px | **desktop layout** |
| Any iPad, landscape | 1024–1366px | **desktop layout** |

Two concrete defects:

1. **The 700–900px band is an unowned hybrid.** Grids collapse to one column
   (mobile-ish), but `.nav-pills` (top nav) stays shown and `.mobile-tabbar`
   never appears — the tabbar is gated at `≤700px`. No safe-area padding, only
   partial touch-target bumps. This state is the accidental intersection of two
   phone breakpoints firing on a big screen; nobody designed or verified it.
2. **iPad landscape + 12.9" portrait get the pure desktop layout,** which
   assumes `:hover` (only `.quick-add-hint` is guarded by `@media (hover: none)`,
   line 561), offers no touch tabbar, and caps content at the 960px shell with
   520/640px columns.

Also: iPad is absent from the QA loop (`dev:phone` is iPhone-only), and the
standalone/manifest safe-area handling was tuned for the iPhone notch.

## Goal (chosen scope)

Remove the broken hybrid and make iPad — portrait and landscape — a coherent,
touch-friendly experience **reusing the existing phone and desktop layouts**.
No master-detail splits, no new multi-column tablet layouts, no per-screen
design intent. Pure breakpoint + touch/hover + verification work.

## Design decision: the coherent split

Route each iPad by orientation into an existing, already-designed state:

- **Portrait tablets → phone chrome.** Bottom `.mobile-tabbar`, hidden
  `.nav-pills`, safe-area shell padding, ≥44px targets. Content is already
  single-column at these widths.
- **Landscape tablets → desktop chrome.** Top nav-pills, existing multi-column
  layout — but made hover-safe and touch-target-safe.

Mechanism: change the chrome-swap trigger from purely `max-width: 700px` to
**also fire on `(pointer: coarse) and (max-width: 1024px)`**. This catches every
portrait iPad (744–1024px) while leaving landscape iPad Pro (1180–1366px) on
desktop chrome. Exact device widths get confirmed in Phase 0 before the trigger
is finalized — do not hardcode a width the sweep hasn't confirmed.

## Constraints (from CLAUDE.md — non-negotiable)

- **CSS-only, no schema, no deps.** Low intrinsic risk — but it touches every
  screen, so this ships as a branch → **PR** (the right risk tool for a
  broad style change) with a full-screen sweep, not direct-to-`main`.
- **Design values via tokens only.** Any new breakpoint constant or width cap
  is documented in [design-system.md](../design-system.md); no inlined magic
  numbers beyond the existing per-selector convention.
- **Playwright WebKit ≠ real Safari** (global rule). The local sweep is
  necessary but not sufficient; the work ends with a "Needs Mitchell" digest for
  real iPad Safari + iPadOS standalone.
- No commit / push / merge without explicit approval.

## Phases

### Phase 0 — Baseline the defect (measure before touching)
Drive the current build on the local stack with Playwright at iPad viewports —
portrait **820×1180**, **834×1194**, **1024×1366**; landscape **1194×834**,
**1366×1024** — across all six screens (Today, Recipes, Recipe detail, Plan,
Shop, Settings). Screenshot + catalogue every defect: missing tabbar, hover-only
affordances, sub-44px targets, marooned narrow columns, safe-area gaps. Confirm
the real device widths that must drive the trigger. **Output:** a defect table
(feeds [design-flags.md](../design-flags.md)); this grounds the work in observed
reality, not assumption.

### Phase 1 — Navigation-chrome coherence (the core fix)
Change the tabbar / nav-pills / safe-area trigger so portrait iPads get the
bottom tabbar and landscape iPads keep the desktop top-nav (mechanism above).
Behavior-affecting CSS only, no JS. Verify the split holds at every Phase-0
viewport.

### Phase 2 — Touch & hover safety
Audit every `:hover` in `app/globals.css`; guard or duplicate so coarse-pointer
devices have a usable resting state (extend the existing `@media (hover: none)`
pattern, and/or gate hover-only reveals behind `@media (hover: hover)`). Bump
any remaining sub-44px targets in the tablet band to match the phone treatment.

### Phase 3 — Content-width sanity (portrait only, minimal)
Confirm the collapsed single-column content reads well and isn't marooned inside
a wide 820–1024px frame. If a column is uncomfortably narrow, widen its cap
**within the existing layout** (e.g. a tablet-tier bump to `page-col`) — **not** a
new multi-column layout. Skip entirely if Phase 0 shows it reads fine.

### Phase 4 — Verify, document, release
- Playwright sweep: all six screens × the Phase-0 viewports on the local stack;
  `npm run typecheck` / `test` / `build`.
- **"Needs Mitchell" digest:** exact URLs/screens to check in real iPad Safari
  (portrait + landscape) and iPadOS home-screen standalone.
- Docs: update [design-system.md](../design-system.md) Breakpoints table (new
  chrome rule + tier), CLAUDE.md "primary targets" line (add iPad),
  [current-state.md](../current-state.md) page-status, and record the decision
  in [decisions.md](../decisions.md) + a dated [progress-log.md](../progress-log.md)
  entry.
- Branch `codex/ipad-coherence` → PR → owner review → merge (merge = deploy).

## Explicitly out of scope
- Master-detail / split layouts, wider Plan grids, two-up cards (that was the
  "first-class iPad" option, not chosen).
- Any schema, data, or dependency change.
- Auth-screen work (folds into the deferred auth-flow track).

## Open questions for the owner
- **Landscape iPad content width:** desktop caps content at the 960px shell,
  leaving side gutters on a 1194–1366px screen. Accept the gutters (treat exactly
  like desktop, the minimal choice) — or widen the shell on landscape tablet?
  Recommend: accept for now; revisit only if the sweep makes it look broken.
- **12.9" portrait (1024px):** gets the tabbar under the proposed trigger but
  keeps desktop multi-column content. Confirm that hybrid is acceptable, or pull
  it fully into portrait-phone chrome.
