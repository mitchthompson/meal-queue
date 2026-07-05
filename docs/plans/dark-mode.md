# Milestone 14: Dark mode (system-follow) — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Dark token VALUES are owner-gated through board mocks — candidate values below are for the mocks, not for shipping unapproved.

---

## 1. Context (why)

There is no dark mode and no `prefers-color-scheme` query anywhere (`docs/design-system.md:108-111`, re-verified 2026-07-05). The token system makes this cheap: every color flows through `--color-*` primitives in `app/globals.css:5-22` with semantic aliases at 36-42. A dark `:root` override block is the whole mechanism. The slate token set (26-34, used by the Cook takeover and the Shop order bar) is the in-canon dark palette to build from.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Activation | Follow the system only (`prefers-color-scheme: dark`). NO settings toggle, NO schema change, NO flash-handling JS. |
| Mechanism | One `@media (prefers-color-scheme: dark)` block overriding `--color-*` primitives only. Semantic aliases and all component CSS stay untouched. Add `color-scheme: light dark` to `:root`. |
| Already-dark surfaces | Cook takeover and Shop order bar keep their scoped slate styling verbatim — they are dark in both schemes by design. |
| Token values | Candidates in §3 go to the review board as mocks (round of pins DM1-DM3). Owner verdicts become the shipped values and get recorded in `docs/design-system.md` as a "Dark tokens" table. NOTHING ships unapproved. |
| theme-color | `viewport.themeColor` becomes a media-conditional pair (Next.js supports the array form). `manifest.ts` `background_color`/`theme_color` stay light-only (the web manifest has no media support — documented limitation). |

Zero schema changes. Zero new npm dependencies. **This is a template-wide change: the cross-project rule applies — full-screen sweep in both schemes + a "Needs Mitchell" real-device digest at the end.**

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd.
2. **Never**: commit, push, merge, install/upgrade dependencies, change schema, or touch live data.
3. **Design values only via tokens.** The dark block defines tokens; components never gain scheme-specific rules. If a component looks wrong in dark, the fix is a token value (flag it), not a component override — with ONE sanctioned exception in §4c.
4. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
5. **Batch-Read before editing:** `app/globals.css` (WHOLE file — you must see every consumer), `lib/design-tokens.ts`, `app/layout.tsx`, `app/manifest.ts`, `docs/design-system.md`, `scripts/review-board/README.md`.
6. Baseline before starting AND before done: `npm run typecheck && npm run test && npm run lint`.
7. `rtk` proxies shell commands; rerun as `rtk proxy <cmd>` if truncated.

**STOP points:** ① after mocks deploy (owner pins DM verdicts — gates ALL code work); ② before ANY commit; ③ senior `/code-review` before merge.

Branch: `codex/dark-mode`. One PR, after the board round.

---

## 3. Phase A — board mocks (round pins DM1-DM3)

Follow `scripts/review-board/README.md` (local app, reviewer account, seeded data, redeploy to the EXISTING artifact URL). Capture with Playwright `colorScheme: "dark"` emulation after injecting the candidate token block as a `<style>` override. Shoot at minimum: Today, Plan, Shop (with the order bar visible), Recipes list, recipe detail, Settings — all 390px.

**Candidate dark block for the mocks** (derived from the slate set where canon exists; values marked NEW are proposals the owner must judge):

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #131a18;              /* = --color-slate */
    --color-surface: #1d2724;         /* = --color-slate-2 */
    --color-surface-muted: #242f2b;   /* NEW: one step above slate-2 */
    --color-text: #f3f6f4;            /* = --color-slate-text */
    --color-text-muted: #9fb0aa;      /* = --color-slate-text-muted */
    --color-primary: #3aa693;         /* NEW: teal lifted for dark contrast */
    --color-primary-soft: #1c3a34;    /* NEW */
    --color-on-primary-soft: #2a4c45; /* NEW */
    --color-on-primary-muted: #35594f;/* NEW */
    --color-accent: #e8a13d;          /* unchanged: amber already reads on dark */
    --color-accent-soft: #3a2f18;     /* NEW: dark amber wash */
    --color-accent-deep: #f0b962;     /* NEW: deep flips light for text-on-dark */
    --color-border: #2a3733;          /* = --color-slate-border */
    --color-check-border: #3d4c47;    /* NEW */
    --color-success: #4caf7d;         /* NEW: lifted */
    --color-warning: #d19a4a;         /* NEW: lifted */
    --color-danger: #e07d7d;          /* NEW: lifted */
    --focus-ring: #3aa693;            /* follows primary */
  }
}
```

Pins:
| Pin | Mock | Question for owner |
|---|---|---|
| DM1 | All six screens in the candidate palette, light versions alongside | Overall: does this read as Meal Queue at night? Any screen that fails? |
| DM2 | Primary-action close-ups (teal buttons, teal links, focus ring) at `#3aa693` vs a brighter `#4dbfa9` | Which teal? |
| DM3 | Status trio (success/warning/danger text, the amber import callout, the M10 stale banner if merged) on dark surface | Do the lifted status colors read right? |

STOP ① — verdicts become the shipped values. Record each verdict in `docs/decisions.md` per house pattern.

---

## 4. Phase B — implementation

### 4a. `app/globals.css`
1. Add `color-scheme: light dark;` inside the existing `:root` block.
2. Append the owner-approved dark block immediately after `:root` (before any component styles), with a comment header: `/* Dark scheme (milestone 14) — overrides primitives only; aliases and components untouched. Values owner-approved <date>, board round <n>. */`
3. The ONE literal outside `:root` — `box-shadow: 0 4px 12px rgba(31, 35, 31, 0.04)` at line ~1809 — is invisible-but-harmless on dark. Tokenize it as `--shadow-panel` in BOTH schemes (light keeps the current value; dark gets `0 4px 12px rgba(0, 0, 0, 0.3)`), consume it at the one site, and note it in `docs/design-system.md`. This closes the known guard gap (the hex-grep doesn't catch `rgba`).
4. Touch NOTHING in the `.cook-mode` (1505+) and `.shop-orderbar` (1208+) scoped blocks.

### 4b. `lib/design-tokens.ts` + `app/layout.tsx` + `app/manifest.ts`
1. `lib/design-tokens.ts`: add `TOKEN_COLOR_BG_DARK = "<approved --color-bg dark value>"` with the lockstep comment matching the existing two.
2. `app/layout.tsx` viewport:
   ```ts
   themeColor: [
     { media: "(prefers-color-scheme: light)", color: TOKEN_COLOR_BG },
     { media: "(prefers-color-scheme: dark)", color: TOKEN_COLOR_BG_DARK },
   ],
   ```
3. `app/manifest.ts`: unchanged; add a comment noting the manifest is light-only because the spec has no media support.

### 4c. Sanctioned exception
If (and only if) the sweep in §5 shows the slate-on-slate Shop order bar losing its edge against the dark page bg, add a single rule `@media (prefers-color-scheme: dark) { .shop-orderbar { border: 1px solid var(--color-slate-border); } }` — this is scoped, token-only, and pre-approved. Anything else that looks wrong: STOP and flag.

---

## 5. Verification

1. typecheck / test / lint / `npm run build` green.
2. **Both-scheme sweep** (clone the iPad sweep harness pattern from the M7-era scripts): Playwright Chromium, `colorScheme: "light"` and `"dark"`, 390px and 1280px, all six screens plus Cook mode open and the import flow entry — screenshot each; assert zero console errors; assert `getComputedStyle(document.body).backgroundColor` matches the scheme's `--color-bg`.
3. Contrast audit (mechanical): for the pairs (text on bg, muted on bg, muted on surface, primary-btn text on primary, accent-deep on accent-soft, danger on bg) compute WCAG ratios at the approved values in BOTH schemes; all ≥4.5:1 except large-text cases ≥3:1. Fail → STOP, flag the value, owner picks a replacement (never adjust silently).
4. Hex guard still clean: `grep -E '#[0-9a-fA-F]{3,8}' app/globals.css` hits only the two `:root` token blocks; additionally grep for `rgba(` and confirm only the two `--shadow-panel` definitions.
5. Cook mode and the order bar render byte-identically in both schemes (visual diff of their screenshots across schemes — allow only the page-bg edge).
6. **Needs Mitchell digest (end of PR, before merge):** real-device checks Playwright can't prove — iPhone standalone app in dark system mode (status-bar/safe-area color, theme-color header tint), light↔dark live switch with the app open, iPad portrait+landscape dark, VoiceOver pass on Today in dark. List exact URLs/screens in the PR description.

**Acceptance:**
- System-dark devices get the approved dark palette on every screen with zero component-level scheme rules (one sanctioned exception).
- Light scheme is byte-identical to today (screenshot diff of the light sweep against pre-branch captures).
- Contrast audit passes; hex/rgba guards pass; theme-color follows the scheme.

## 6. Do-not-touch list

`supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, all component `.tsx` files (this milestone is CSS + the three token-mirror files only), `.cook-mode` and `.shop-orderbar` style blocks.
