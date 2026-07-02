# Design System

The UI source of truth for Meal Queue. There is no external design tool (no Figma).
**[`app/globals.css`](../app/globals.css) is canonical**; this document describes
what is in that file. When the two disagree, the CSS wins — read it (and update this
doc) rather than trusting a restatement here.

## The token / namespace rule

This is a single self-contained app — nothing else shares the DOM — so **no CSS class
prefix is used**. The CSS-variable token system in `app/globals.css` *is* the namespace.

- All color, typography, and recurring spacing flow through the `--color-*` raw tokens
  and their short semantic aliases (`--bg`, `--surface`, `--ink`, `--muted`, `--brand`,
  `--brand-2`, `--line`).
- **Never hardcode a hex value, font, or magic spacing number in a component.** If a
  needed token is missing: add it to `app/globals.css`, document it here, and link it
  from [design flags](design-flags.md) — or, if you cannot add it now, flag the gap in
  [design flags](design-flags.md). Never inline a one-off value.

> Status: the stylesheet honors this rule as of the v2 sweep part 1 (milestone 7,
> `codex/v2-token-sweep`). Every pre-v2 literal — `#fff`/`#ffffff`/`#fffefb`
> backgrounds, the cream borders `#c9bba6`/`#e4d8c6`, the pantry-badge one-off
> palette, the old meta ink `#3d443d` — was replaced with its v2 token.
> `grep -E '#[0-9a-fA-F]{3,8}' app/globals.css` must hit only the `:root` token
> definitions; keep it that way.

---

## Color tokens

Defined in `:root` (lines 1–23 of `app/globals.css`). Two layers: raw `--color-*` tokens,
then short semantic aliases pointing at the common ones.

### Raw tokens (token set v2, 2026-07-02)

Token set v2 landed with the reflow ([redesign-brief.md](redesign-brief.md)):
paper ground, deep green-black ink, one sharpened-teal accent, warm amber for
attention. The cream/terracotta v1 values are retired.

| Variable | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#fafaf8` | Base page background (paper, faint warm bias). No decorative gradients (retired in v2). |
| `--color-surface` | `#ffffff` | Default raised surface. Cards, panels, pills, mobile tabbar, tonight-card button. |
| `--color-surface-muted` | `#edeeea` | Muted/inset surface tint. Secondary button, step-index badge. |
| `--color-text` | `#16211e` | Primary body/ink text (deep green-black). |
| `--color-text-muted` | `#5e6b67` | Secondary/muted text — labels, captions, meta, descriptions. |
| `--color-primary` | `#12695e` | Brand primary (sharpened teal) — the single accent. Links, primary button, active states, tonight hero, focus-ring source. |
| `--color-primary-soft` | `#e3eeeb` | Soft tint of primary. Active chips, ghost/nudge buttons, `plan →` pill. |
| `--color-on-primary-soft` | `#cfe2dd` | Meta text on a `--color-primary` surface (tonight-card meta). |
| `--color-on-primary-muted` | `#bfd9d3` | Label text on a `--color-primary` surface (tonight-card label). |
| `--color-accent` | `#e8a13d` | Warm amber attention accent (v2 single warm; terracotta retired). Context-strip dot; aliased to `--brand-2` (link hover). |
| `--color-accent-soft` | `#f6e8cf` | Amber-tinted soft surface — leftover pill background. |
| `--color-accent-deep` | `#7a5a17` | Deep amber-brown — leftover pill text. |
| `--color-border` | `#e4e6e1` | Default border/divider (hairline). Aliased to `--line`; used on nearly all bordered elements. |
| `--color-success` | `#1e7b4f` | Success state (green). Used by `.success-text`. |
| `--color-warning` | `#a3661f` | Warning state (amber/brown). **Defined but currently unused** — no selector references it. |
| `--color-danger` | `#a13c3c` | Danger/error (muted red). Danger button bg/border, `.error-text`. |
| `--focus-ring` | `#12695e` | Focus outline color (identical value to `--color-primary`). Used in `:focus-visible`. |

### Slate tokens (the v2 dark set)

The dark half of token set v2 ([redesign-brief.md](redesign-brief.md)),
introduced with Cook and shared by Shop's pinned order bar. Values come from
the approved mockup ([mockups/reflow-v1.html](mockups/reflow-v1.html)). This is
a scoped surface treatment — not a global dark mode. (Introduced as
`--color-cook-*` with the Cook screen; renamed to `--color-slate-*` when Shop
started sharing them.)

| Variable | Value | Role |
| --- | --- | --- |
| `--color-slate` | `#131a18` | Dark surface background — Cook takeover, Shop order bar. Also the text color on the amber Next button. |
| `--color-slate-2` | `#1d2724` | Raised surface on slate — cook chips, Back button, unfilled progress dots. |
| `--color-slate-text` | `#f3f6f4` | Primary text on slate. |
| `--color-slate-text-soft` | `#cbd8d3` | Soft text on slate — cook ingredient-chip text. |
| `--color-slate-text-muted` | `#9fb0aa` | Secondary text on slate — cook exit/step count, order-bar small line. |
| `--color-slate-text-dim` | `#5e6b67` | Dimmest text on slate — the wake-lock note. |
| `--color-slate-border` | `#2a3733` | Chip border on slate. |

Amber on slate comes from the global `--brand-2` / `--color-accent`
(`#e8a13d`): cook progress/Next/focus ring, and the Shop order-bar count.
Slate surfaces inherit the native `--font-body` stack. `--color-check-border`
(`#c6ccc6`) is the rest-state border of Shop's 30px checkboxes.

### Semantic aliases

Short names for the most common raw tokens. **Prefer the alias** where one exists.

| Alias | Resolves to | Use |
| --- | --- | --- |
| `--bg` | `var(--color-bg)` → `#fafaf8` | Page background |
| `--surface` | `var(--color-surface)` → `#ffffff` | Cards, panels, pills |
| `--ink` | `var(--color-text)` → `#16211e` | Primary text |
| `--muted` | `var(--color-text-muted)` → `#5e6b67` | Secondary text |
| `--brand` | `var(--color-primary)` → `#12695e` | Links, primary button, active state |
| `--brand-2` | `var(--color-accent)` → `#e8a13d` | Link hover, context-strip dot |
| `--line` | `var(--color-border)` → `#e4e6e1` | Borders and dividers |

These raw tokens have **no alias** and are referenced by their full `--color-*` name:
`--color-surface-muted`, `--color-primary-soft`, `--color-on-primary-soft`,
`--color-on-primary-muted`, `--color-accent-soft`, `--color-accent-deep`,
`--color-check-border`, the `--color-slate-*` set, `--color-success`,
`--color-warning`, `--color-danger`, plus `--focus-ring`.

### Decorative gradients

Retired in v2 — `body` is flat `var(--bg)` at every breakpoint.

There is **no dark mode** and no `prefers-color-scheme` query. The one dark
surface is the Cook takeover (`.cook-mode`), which uses the scoped
`--color-slate-*` tokens rather than a theme switch.

---

## Typography

Token set v2: the native system stack everywhere — "installed-app feel is the
thesis" ([redesign-brief.md](redesign-brief.md)). The Fraunces/Manrope Google
fonts (and their `next/font` injection in `layout.tsx`) are retired; fonts are
plain CSS tokens in `globals.css :root`.

| Role | Variable | Value |
| --- | --- | --- |
| Body (`body`) | `--font-body` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif` |
| Headings (`h1`–`h4`) | `--font-heading` | `var(--font-body)` (no decorative serif) |

- Body: `font-size: 16px`, `line-height: 1.6`, antialiased.
- Headings: `line-height: 1.25`, `letter-spacing: -0.015em`, weight 700.
- `tabular-nums` on amounts (cook chips, shop counts) via `font-variant-numeric`.
- Recipe title (`.recipe-title-row h1`) uses fluid sizing: `clamp(1.6rem, 2.4vw, 2.2rem)`.
- Eyebrow (`.eyebrow`): uppercase, `letter-spacing: 0.08em`, `--brand`, weight 700, `0.8rem`.

---

## Focus ring

One global treatment — no per-component overrides, no box-shadow ring:

```css
a:focus-visible, button:focus-visible,
input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--focus-ring); /* #12695e */
  outline-offset: 2px;
}
```

---

## Breakpoints

Design is **desktop-first** with two `max-width` overrides; there are no `min-width`
(desktop-up) queries.

| Query | Target | What changes |
| --- | --- | --- |
| `@media (max-width: 900px)` | tablet / landscape | Multi-column grids collapse to one column (`split-layout`, `recipe-view-layout`); `ingredient-row` → 2 cols; `recipe-overview-panel` goes static; `section-head` stacks; section-action buttons bump to `min-height: 2.75rem`; small muted text bumps to `0.9rem`/`1.45`. |
| `@media (max-width: 700px)` | mobile / phone | `.shell` adds safe-area + ~6rem bottom space; `.panel` gains a soft shadow and radius `12px` (skin stays `var(--surface)`/`var(--line)` — the cream literals retired in the v2 sweep); `.nav-pills` hidden and `.mobile-tabbar` shown (fixed bottom, 4-col icon+label, `blur(6px)`, `z-index: 20`); rows stack to one column; recipe-title actions → 2-col grid; pills `min-height: 2.5rem`, font `0.92rem`. |

---

## Spacing & radius conventions

There are **no spacing-scale tokens** — spacing is expressed inline in `rem`/`px` per
selector. The recurring, observed values below are the conventions to match; do not invent
new ad-hoc numbers when one of these fits.

- **Radius:** `16px` for cards/panels; `12px` for list items and inner card blocks
  (`plan-dayrow`/`plan-sheet` inner blocks); `10px` for buttons, inputs,
  small inner blocks (`grocery-row`, `quick-add-card`, `home-stat`, recipe meta/step);
  `999px` for pills, chips, badges, and the circular step index.
- **Layout shell:** `.shell` is `max-width: 960px`, centered, padding `1.75rem 1rem 3rem`.
- **Grid gaps:** common values `0.45rem`, `0.5rem`, `0.6rem`, `0.65rem`, `0.8rem`, `1rem`.
- **Auto-fit card grid:** `.grid` uses `repeat(auto-fit, minmax(220px, 1fr))`, gap `0.8rem`.
  Feature grids use fixed-column `repeat()` that collapse to `1fr` at ≤900px.

---

## Recurring UI patterns

### Cards & panels

- `.card`: `bg var(--surface)`, `1px solid var(--line)`, radius `16px`, padding
  `1rem 1rem 1.1rem`. `h2` `1.05rem`; `p` uses `--muted` at `0.94rem`/`1.5`; links
  `--brand` bold, hover `--brand-2`.
- `.panel`: like a card, radius `16px`, padding `1rem 1.05rem`, `margin-top: 1rem`. On
  mobile the radius drops to `12px` and it gains a soft shadow (same
  `var(--surface)`/`var(--line)` skin as desktop since the v2 sweep).

### Surfaces (inner blocks)

Most inner blocks (`.list-item`, `.chip`, `.grocery-row`, `.quick-add-card`,
`.recipe-step-item`, `.recipe-meta`) use `var(--surface)` + `1px solid var(--line)` +
radius `10–12px`. (Their pre-v2 literal `#fff`/`#fffefb` backgrounds were tokenized
in the v2 sweep part 1.)

### Buttons

Shared base across `.primary-btn`, `.secondary-btn`, `.danger-btn`, `.ghost-btn`,
`.text-btn`: radius `10px`, `1px solid var(--line)`, `min-height: 2.5rem`, padding
`0.5rem 0.85rem`, inline-flex centered, `gap 0.35rem`, weight 600, `0.92rem`, base bg `var(--surface)`.

| Variant | Background | Border | Text |
| --- | --- | --- | --- |
| `.primary-btn` | `var(--brand)` | `var(--brand)` | `var(--surface)` |
| `.secondary-btn` | `var(--color-surface-muted)` | `var(--line)` | `var(--ink)` |
| `.ghost-btn` | `var(--surface)` | `var(--line)` | `var(--brand)` |
| `.danger-btn` | `var(--color-danger)` | `var(--color-danger)` | `var(--surface)` |
| `.text-btn` | transparent | none | `var(--brand)` — no min-height, `0.88rem` |

### Pills, chips, badges

- `.pill`: radius `999px`, `1px var(--line)`, `bg var(--surface)`, padding `0.45rem 0.8rem`,
  `0.88rem`/600. `.pill.active` → bg+border `var(--brand)`, `var(--surface)` text.
- `.chip`: radius `999px`, `var(--line)` border, `bg var(--surface)`. `.chip.active` → border
  `var(--brand)` + bg `var(--color-primary-soft)`.
- `.recipe-step-index`: `1.7rem` circle, `999px`, `var(--line)` border,
  `bg var(--color-surface-muted)`, bold centered number.
- `.pantry-badge`: the warm amber badge — border `var(--color-accent)`,
  bg `var(--color-accent-soft)`, text `var(--color-accent-deep)`. Tokenized in the
  v2 sweep part 1, mirroring `.chip.active`'s strong-border-on-soft-tint pattern on
  the amber side (the leftover pill's palette).

### Form controls

- `input, select, textarea`: full-width, radius `10px`, `1px var(--line)`, padding
  `0.55rem 0.6rem`, explicit `bg var(--surface)`, `color var(--ink)`; `textarea` resizes vertical.
- `label`: grid with `0.25rem` gap, `0.88rem`, `--muted`.
- Inline checkboxes (`.inline-check`, `.grocery-check`) reset `width: auto` on the input.

### Today components

`app/page.tsx` + the `.today-*` / `.tonight-*` selectors, from the reflow
mockup. Content column capped at `640px` (`.page-col`) — the mockup only
specifies the phone layout.

- `.tonight-card`: the hero — `--brand` surface, `--surface` text, radius
  `18px`, big balanced title; label/meta use the on-primary tint tokens; the
  white `.tonight-btn` deep-links into Cook mode (`?cook=1`).
- `.today-strip`: deadline strip — surface card, 9px `--brand-2` dot, bold
  line + muted `small`; whole strip is a link to `/grocery`.
- `.today-week`: `.card` with hairline-separated rows — 44px uppercase day
  abbreviation, weighted meal name, muted meal-type `small`; amber
  `.today-pill-warm` for leftovers; `.today-pill` (`--color-primary-soft`)
  as the `plan →` affordance on empty days.
- `.today-next`: nudge card — label + line on the left,
  `.today-next-btn` (primary-soft) on the right.
- Navigation: 4-tab reflow bar (Today / Plan / Shop / Recipes); Settings is
  the gear in the Today header (`.today-settings`).

### Plan components

`app/plans/page.tsx` + `components/plan-day-items.tsx` + the `.plan-*`
selectors, from the mockup's day-row direction, over the `use-plan` data
layer. Since review round 1 (PR #18, 2026-07-02) each day card is one flat
meal list — no L/D sub-slots; `.plan-slot` now styles a meal row and
`.quick-add-row` the 44px recipe results. Column capped by `.page-col`.

- `.plan-dayrow`: one card per plan day — uppercase `.plan-dhead`
  (day abbreviation + date; teal + "· today" on today's row), then one
  `.plan-slot` row per meal in added order (no meal-type labels; the
  `.plan-slot-k` L/D key retired with the flat-day rework).
- Meal rows: recipe link (or eat-out note), `.plan-slot-sub` for leftover
  provenance, compact `−/×N/+` serving controls, small `remove`; days with
  meals end in a `.plan-slot-more` "+ add another meal" line.
- Empty days: "Nothing planned" + the 30px `.plan-slot-add` (+) button —
  quick-add (mode pills: Cook / Leftovers / Eating out) opens inline in a
  `.plan-quick-wrap` band under the day; recipe results are
  `.quick-add-row` buttons (≥44px, name + serves count, recently-planned
  first) and the keyboard hint hides on touch (`.quick-add-hint`).
- `.plan-sheet`: the New-plan / Edit-plan panels (2-col date grid), toggled
  from the header; sheets auto-close when the working plan changes.
- `.plan-generate`: the flow's exit — full-width teal link to `/grocery`
  (Shop regenerates from staleness on load).

### Shop components

`app/grocery/page.tsx` + the `.shop-*` selectors, from the mockup's chunky
direction, over the unchanged `use-grocery-list` data layer. Column capped by
`.page-col`.

- `.shop-orderbar`: pinned deadline bar — `--color-slate` surface, "Order
  today/tomorrow/{Day}" + pickup `small`, big amber `tabular-nums` unchecked
  count (`.shop-count`).
- `.shop-section-head`: sticky uppercase section labels ("Groceries",
  "Pantry check", "On hand (N)") with small check-all/uncheck-all text
  actions.
- `.shop-item`: hairline-separated rows — 30px `.shop-check` button
  (`--color-check-border` rest state; checked = `--brand` fill, white ✓),
  `1.02rem` name (checked = muted + strikethrough), `tabular-nums` amount,
  small muted per-row move actions (have this / move to groceries / move
  back).

### Cook-mode takeover

`components/cook-mode.tsx` + the `.cook-*` selectors. A `position: fixed;
inset: 0` full-screen dialog at `z-index: 30` (above the mobile tabbar's 20),
styled entirely from the `--color-slate-*` tokens and the global amber:

- One step at a time: amber uppercase step label, step body at `1.7rem`/700
  with `text-wrap: balance`, that step's ingredients as chips (`999px` pills on
  `--color-slate-2`, `tabular-nums` amounts).
- Progress: flexed 4px bars (`.cook-dots`), filled with `--brand-2`
  up to the current step; decorative (`aria-hidden`).
- Nav: giant amber Next (`flex: 1`, radius `16px`, `1.25rem` padding) beside a
  30%-width slate Back (visibility-hidden on step 1 to keep layout stable);
  last step relabels Next to "Done — mark cooked".
- Screen wake-lock while mounted (best-effort, re-acquired on
  `visibilitychange`); the "screen stays awake" note renders only while the
  lock is actually held.
- Safe-area aware top and bottom (`env(safe-area-inset-*)`); body scroll is
  locked behind the takeover; Escape exits.

### Status text & misc

- `.error-text` → `var(--color-danger)`; `.success-text` → `var(--color-success)`.
- `.muted` utility → `var(--muted)`, `0.85rem`.
- `details`/`summary` power collapsibles (recipe danger menu, recipe details,
  home next-week) with `list-style: none` and a hidden webkit marker.
- **Navigation** is centralized in [`components/app-shell.tsx`](../components/app-shell.tsx):
  desktop `.nav-pills` is hidden under 700px and replaced by the fixed bottom
  `.mobile-tabbar` (5-col, blurred, safe-area aware) with `.mobile-tab` / `.mobile-tab.active`.

---

## Step-by-step: building a component

Follow this build order for any UI change. The page-intent doc and the tokens are the
inputs you confirm *before* writing markup.

1. **Read the page intent + tokens.** Open the relevant
   [page doc](pages/) — `docs/pages/<slug>.md` (e.g.
   [today](pages/today.md), [recipes](pages/recipes.md),
   [plans](pages/plans.md), [grocery](pages/grocery.md),
   [settings](pages/settings.md)) — for the intended states and copy, plus this
   document for the tokens/patterns. Confirm data shape against
   [`supabase/schema.sql`](../supabase/schema.sql) / [data model](data-model.md) and the
   route's behavior in [routes](routes.md). Never guess a column, default, or token value.
2. **Use only confirmed tokens — no raw hex.** Style with the `--color-*` tokens and
   semantic aliases above and reuse the recurring patterns (card, button, pill, surface).
   If a needed token does not exist, add it to [`app/globals.css`](../app/globals.css) and
   document it here; if you can't add it now, record the gap in
   [design flags](design-flags.md). Do not inline a one-off hex/font/spacing value.
3. **Compose classes with `clsx`.** Build conditional class strings with `clsx` (the
   project's only class-composition tool — there is no Tailwind). Reuse existing class
   names (`.card`, `.panel`, `.primary-btn`, `.pill`, `.chip`, …) before inventing new ones.
4. **View it locally.** Run `npm run dev` and open the page in a desktop browser and at
   the iPhone Safari width — the two primary targets. Check both breakpoints (≤900px,
   ≤700px) and the page's empty / loading / error states.
5. **Verify against tokens, then run the gate.** Confirm no raw hex/font/spacing leaked in
   and that the result matches this doc and the page doc. Then run `npm run lint`,
   `npm run typecheck`, and `npm run test` (add `npm run build` for build-affecting
   changes). See [qa](qa.md) for the full end-of-session checklist.
6. **Commit only after approval.** Sub-agents never commit. The orchestrator commits after
   explicit user approval, using Conventional Commits and **no `Co-Authored-By` trailer**.
   A push to `main` deploys to Vercel and is itself a release action needing approval.

---

## Related docs

- [Design flags](design-flags.md) — open token gaps / hardcoded-value inconsistencies.
- [Architecture](architecture.md) — stack, structure, deploy.
- [Routes](routes.md) and per-page intent under [`docs/pages/`](pages/).
- [Data model](data-model.md) and canonical [`supabase/schema.sql`](../supabase/schema.sql).
- [QA](qa.md) — verification commands and acceptance checks.
