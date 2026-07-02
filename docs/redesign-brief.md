# Redesign Brief — The Reflow

Owner-approved direction (2026-07-02, enthusiastic): reorganize the app around
the household's real weekly cycle instead of entity tabs, with a look-and-feel
update. Direction mockups (tappable, reviewed on-device): calm-utility base +
bold/chunky treatment where hands are busy — **source in-repo at
[mockups/reflow-v1.html](mockups/reflow-v1.html)** (self-contained; open in any
browser or serve statically to view on a phone). App icon source:
[assets/icon-source.svg](assets/icon-source.svg) (regenerate PNGs with sharp,
see progress-log 2026-07-02).

## The organizing idea

The app's life is a cycle, not a database:

| Mode | When | The screen's single job |
| --- | --- | --- |
| **Plan** | Once a week | Fill the week's slots fast, thumb-first; exit = generate groceries |
| **Shop** | Order day | Scan-and-check the list; order/pickup deadline always visible |
| **Cook** | Daily | Tonight's recipe, one step at a time, kitchen-proof |

**Today** is the home screen: it opens to *what today needs* — tonight's meal
one tap from cooking mode, the grocery deadline when it's near, a week peek,
and a "plan next week" nudge when the current plan is ending. The
dashboard-of-everything is retired.

## Screens (as mocked)

- **Today**: date header; "Tonight" hero card (recipe, servings, Start
  cooking); context strip (order due / pickup date, unchecked count); This
  Week peek (compact day rows, leftover pills); Next Week nudge card.
- **Plan**: day rows with L/D slots as tappable chips; quick-add (+) is the
  primary action; today highlighted; "Generate grocery list" as the flow's
  exit; range/order/pickup editing tucked behind an edit sheet.
- **Shop**: pinned order/pickup bar with live unchecked count; 30px chunky
  checkboxes; groceries vs pantry-check sections; checked style = teal fill +
  strikethrough. (State preservation under replans is milestone 4 — done.)
- **Cook** (bold treatment): full-screen dark takeover launched from Tonight;
  step N of M in very large type; that step's ingredients as chips; amber
  progress dots; giant Next / smaller Back thumb targets; screen wake-lock
  while active; "Done — mark cooked" on the last step.
- **Recipes**: stays as the library (4th tab); detail view feeds Cook mode.

## Look and feel (proposed token set v2 — NOT yet in globals.css)

- Ground `#FAFAF8` (paper, faint warm bias) · ink `#16211E` (deep green-black)
  · muted `#5E6B67` · hairline `#E4E6E1`
- Single accent: sharpened teal `#12695E` (+ soft `#E3EEEB`) — keeps brand
  lineage, retires the cream/terracotta look and decorative gradients
- Cook mode inverts: slate `#131A18` / `#1D2724`, light `#F3F6F4` type, one
  warm amber `#E8A13D` for progress/heat
- Type: native stack (`-apple-system …`) — installed-app feel is the thesis;
  `tabular-nums` for amounts; no decorative serif (Fraunces retires)
- Chunky radii/targets only where hands are busy (Cook, Shop checkboxes)

Migration: introduce as new `--color-*` values in `globals.css` when the
reflow lands per-screen; the token *system* is unchanged (no hardcoded values,
same variable names where semantics match).

## iOS install quality (learned on the mockups)

`viewport-fit=cover` + `env(safe-area-inset-bottom)` for anything fixed to the
bottom (shipped to the real app in mini-M5 after the owner caught the
home-indicator collision on the installed mockup). Standalone display via the
mini-M5 manifest; wake-lock API for Cook mode (flagged long ago, lands with
Cook).

## Sequencing

1. **Milestone 6 (component hardening)** — the foundation: split the monolith
   route components into data hooks + presentational components,
   behavior-neutral, CI-guarded. The reflow then swaps presentation over a
   stable data layer.
2. **Reflow, screen by screen** (each its own branch/PR on the usual rails):
   suggested order — Cook mode (new, highest owner value), Today (replaces
   dashboard), Shop, Plan. Tabbar changes land with Today.
3. Token set v2 lands with the first reflow screen; old screens keep working
   (they read the same semantic variables).

## Open questions (answer as screens are built)

- Cook mode: timers per step? (Deferred idea; wake-lock is in scope.)
- Today: what does it show plan-less (first run / gap weeks)?
- Shop: keep manual "Regenerate" button, or trust staleness entirely?
- Plan: multi-recipe slots and eat-out notes — chip UI details.
- Dark mode beyond Cook (deferred; Cook's palette is a head start).

Living document — update as owner feedback lands per screen.
