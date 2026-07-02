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

> Honesty note: the current stylesheet itself does **not** fully honor this rule. Several
> components hardcode `#fff`, `#fffefb`, and border colors `#c9bba6` / `#e4d8c6`, and the
> pantry badge uses a one-off palette. These are pre-existing inconsistencies, tracked in
> [design flags](design-flags.md) — match the token rule in *new* work; do not copy the
> hardcoded values.

---

## Color tokens

Defined in `:root` (lines 1–23 of `app/globals.css`). Two layers: raw `--color-*` tokens,
then short semantic aliases pointing at the common ones.

### Raw tokens

| Variable | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#f7f3ea` | Base page background (warm cream/parchment). Layered under two radial gradients on `body`. |
| `--color-surface` | `#fffdf8` | Default raised surface (near-white warm). Cards, panels, pills, mobile tabbar. |
| `--color-surface-muted` | `#f1e8d9` | Muted/inset surface tint. Secondary button, plan-grid header, step-index badge, mobile day cell. |
| `--color-text` | `#1f231f` | Primary body/ink text (near-black warm green-grey). |
| `--color-text-muted` | `#5f665e` | Secondary/muted text — labels, captions, meta, descriptions. |
| `--color-primary` | `#1f6d63` | Brand primary (deep teal/pine). Eyebrow, links, primary button, active states, focus-ring source. |
| `--color-primary-soft` | `#d8eee7` | Soft tint of primary. Background for active chip. |
| `--color-accent` | `#d06a2f` | Secondary brand accent (burnt orange/terracotta). Link hover (`--brand-2`). |
| `--color-border` | `#d5c7b2` | Default border/divider (warm tan). Aliased to `--line`; used on nearly all bordered elements. |
| `--color-success` | `#1e7b4f` | Success state (green). Used by `.success-text`. |
| `--color-warning` | `#a3661f` | Warning state (amber/brown). **Defined but currently unused** — no selector references it. |
| `--color-danger` | `#a13c3c` | Danger/error (muted red). Danger button bg/border, `.error-text`. |
| `--focus-ring` | `#1f6d63` | Focus outline color (identical value to `--color-primary`). Used in `:focus-visible`. |

### Cook-mode tokens (token set v2)

The first tranche of the redesign's token set v2 ([redesign-brief.md](redesign-brief.md)),
introduced with the Cook screen. Values come from the approved mockup
([mockups/reflow-v1.html](mockups/reflow-v1.html)). Scoped to the `.cook-mode`
takeover — this is not a global dark mode. Remaining v2 values (paper ground,
sharpened teal, native type app-wide) land as each reflow screen ships.

| Variable | Value | Role |
| --- | --- | --- |
| `--color-cook-bg` | `#131a18` | Cook takeover background (deep slate). Also the text color on the amber Next button. |
| `--color-cook-surface` | `#1d2724` | Raised surface on slate — ingredient chips, Back button, unfilled progress dots. |
| `--color-cook-text` | `#f3f6f4` | Primary text on slate. |
| `--color-cook-text-soft` | `#cbd8d3` | Ingredient-chip text. |
| `--color-cook-text-muted` | `#9fb0aa` | Secondary text on slate — exit control, step count, Back label. |
| `--color-cook-text-dim` | `#5e6b67` | Dimmest text on slate — the wake-lock note. |
| `--color-cook-border` | `#2a3733` | Chip border on slate. |
| `--color-cook-amber` | `#e8a13d` | The one warm accent — progress dots, step label, Next button, focus ring inside the takeover. |
| `--font-cook` | native stack (`-apple-system …`) | Cook takeover type. First landing of the v2 "installed-app" native-stack direction; the rest of the app keeps Fraunces/Manrope until their screens reflow. |

### Semantic aliases

Short names for the most common raw tokens. **Prefer the alias** where one exists.

| Alias | Resolves to | Use |
| --- | --- | --- |
| `--bg` | `var(--color-bg)` → `#f7f3ea` | Page background |
| `--surface` | `var(--color-surface)` → `#fffdf8` | Cards, panels, pills |
| `--ink` | `var(--color-text)` → `#1f231f` | Primary text |
| `--muted` | `var(--color-text-muted)` → `#5f665e` | Secondary text |
| `--brand` | `var(--color-primary)` → `#1f6d63` | Links, primary button, active state |
| `--brand-2` | `var(--color-accent)` → `#d06a2f` | Link hover |
| `--line` | `var(--color-border)` → `#d5c7b2` | Borders and dividers |

These raw tokens have **no alias** and are referenced by their full `--color-*` name:
`--color-surface-muted`, `--color-primary-soft`, `--color-success`, `--color-warning`,
`--color-danger`, plus `--focus-ring`.

### Decorative gradients (not tokenized)

Used only in the `body` background; do not reuse these as component colors:

- Desktop radials: `#f6d9c7` (warm) and `#d8ece4` (cool).
- Mobile (`max-width: 700px`) linear gradient: `#f9f5ed` → `#f4efe5`.

There is **no dark mode** and no `prefers-color-scheme` query. The one dark
surface is the Cook takeover (`.cook-mode`), which uses its own scoped
`--color-cook-*` tokens rather than a theme switch.

---

## Typography

Fonts are injected by `next/font` in [`app/layout.tsx`](../app/layout.tsx) and attached to
`<body>` as CSS variables — they are **not** declared in `globals.css :root`.

| Role | Variable | Family | Weights | Fallback |
| --- | --- | --- | --- | --- |
| Headings (`h1`–`h4`) | `--font-heading` | Fraunces (Google serif) | 600, 700 | `Georgia, serif` |
| Body (`body`) | `--font-body` | Manrope (Google sans-serif) | 400, 500, 600, 700 | `"Segoe UI", sans-serif` |

- Body: `font-size: 16px`, `line-height: 1.6`.
- Headings: `line-height: 1.25`, `letter-spacing: -0.01em`.
- Recipe title (`.recipe-title-row h1`) uses fluid sizing: `clamp(1.6rem, 2.4vw, 2.2rem)`.
- Eyebrow (`.eyebrow`): uppercase, `letter-spacing: 0.08em`, `--brand`, weight 700, `0.8rem`.

---

## Focus ring

One global treatment — no per-component overrides, no box-shadow ring:

```css
a:focus-visible, button:focus-visible,
input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--focus-ring); /* #1f6d63 */
  outline-offset: 2px;
}
```

---

## Breakpoints

Design is **desktop-first** with two `max-width` overrides; there are no `min-width`
(desktop-up) queries.

| Query | Target | What changes |
| --- | --- | --- |
| `@media (max-width: 900px)` | tablet / landscape | Multi-column grids collapse to one column (`split-layout`, `plan-meta-grid`, `plan-add-grid`, home grids, `recipe-view-layout`, today/week grids); `ingredient-row` → 2 cols; `plan-grid` becomes stacked labeled card rows (Lunch/Dinner labels injected); `recipe-overview-panel` goes static; `section-head` stacks; section-action buttons bump to `min-height: 2.75rem`; small muted text bumps to `0.9rem`/`1.45`. |
| `@media (max-width: 700px)` | mobile / phone | `body` background switches to vertical linear gradient; `.shell` adds safe-area + ~6rem bottom space; `.panel` gains shadow, translucent bg `rgba(255,253,248,0.92)`, border `#e4d8c6`, radius `12px`; `.nav-pills` hidden and `.mobile-tabbar` shown (fixed bottom, 5-col, `blur(6px)`, `z-index: 20`); rows stack to one column; recipe-title actions → 2-col grid; pills `min-height: 2.5rem`, font `0.92rem`. |

---

## Spacing & radius conventions

There are **no spacing-scale tokens** — spacing is expressed inline in `rem`/`px` per
selector. The recurring, observed values below are the conventions to match; do not invent
new ad-hoc numbers when one of these fits.

- **Radius:** `16px` for cards/panels; `12px` for list items and inner card blocks
  (`plan-grid`, `home-week-card`, `home-plan-block`); `10px` for buttons, inputs,
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
  mobile gains a shadow + translucent background.

### Surfaces (inner blocks)

Most inner blocks (`.list-item`, `.chip`, `.grocery-row`, `.quick-add-card`, `home-*`
blocks, `.recipe-step-item`, `.recipe-meta`) use a literal `#fff` (or `#fffefb`)
background + `1px solid var(--line)` + radius `10–12px` — **not** the `--surface` token
directly. This is a known inconsistency (see [design flags](design-flags.md)); for new
components, prefer `var(--surface)`.

### Buttons

Shared base across `.primary-btn`, `.secondary-btn`, `.danger-btn`, `.ghost-btn`,
`.text-btn`: radius `10px`, `1px solid var(--line)`, `min-height: 2.5rem`, padding
`0.5rem 0.85rem`, inline-flex centered, `gap 0.35rem`, weight 600, `0.92rem`, base bg `#fff`.

| Variant | Background | Border | Text |
| --- | --- | --- | --- |
| `.primary-btn` | `var(--brand)` | `var(--brand)` | `#fff` |
| `.secondary-btn` | `var(--color-surface-muted)` | `var(--line)` | `var(--ink)` |
| `.ghost-btn` | `#fff` | `var(--line)` | `var(--brand)` |
| `.danger-btn` | `var(--color-danger)` | `var(--color-danger)` | `#fff` |
| `.text-btn` | transparent | none | `var(--brand)` — no min-height, `0.88rem` |

### Pills, chips, badges

- `.pill`: radius `999px`, `1px var(--line)`, `bg var(--surface)`, padding `0.45rem 0.8rem`,
  `0.88rem`/600. `.pill.active` → bg+border `var(--brand)`, `#fff` text.
- `.chip`: radius `999px`, `var(--line)` border, `bg #fff`. `.chip.active` → border
  `var(--brand)` + bg `var(--color-primary-soft)`.
- `.recipe-step-index`: `1.7rem` circle, `999px`, `var(--line)` border,
  `bg var(--color-surface-muted)`, bold centered number.
- `.pantry-badge`: one-off palette — border `#c9bba6`, bg `#f3eadc`, text `#5e513d`
  (not tokenized; flagged).

### Form controls

- `input, select, textarea`: full-width, radius `10px`, `1px var(--line)`, padding
  `0.55rem 0.6rem`, explicit `bg #ffffff`, `color var(--ink)`; `textarea` resizes vertical.
- `label`: grid with `0.25rem` gap, `0.88rem`, `--muted`.
- Inline checkboxes (`.inline-check`, `.grocery-check`) reset `width: auto` on the input.

### Cook-mode takeover

`components/cook-mode.tsx` + the `.cook-*` selectors. A `position: fixed;
inset: 0` full-screen dialog at `z-index: 30` (above the mobile tabbar's 20),
styled entirely from the `--color-cook-*` tokens and `--font-cook`:

- One step at a time: amber uppercase step label, step body at `1.7rem`/700
  with `text-wrap: balance`, that step's ingredients as chips (`999px` pills on
  `--color-cook-surface`, `tabular-nums` amounts).
- Progress: flexed 4px bars (`.cook-dots`), filled with `--color-cook-amber`
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
   [dashboard](pages/dashboard.md), [recipes](pages/recipes.md),
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
