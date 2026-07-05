# Milestone 15: Richer empty states — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask.

---

## 1. Context (why)

Empty states are uneven (full inventory taken 2026-07-05): Today's are already rich (`tonight-card-empty` with label + heading + CTA, `app/page.tsx:99-107,167-189`); the rest range from a styled one-liner to a bare unstyled `<p>` (`app/recipes/page.tsx:146`). This milestone brings the weak ones up to the Today pattern. It does NOT touch loading states (skeletons stay deferred) and does NOT redesign anything that already works.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Pattern | One shared presentational component `components/empty-state.tsx` (label + heading + body + up to two actions), styled like the existing `tonight-card-empty` family. Text + CTA only — no illustrations, no icons. |
| Scope | Recipes list (both empty variants), Shop no-plan, Plan no-plans. Today keeps its bespoke cards (already the reference pattern). Recipe-detail no-ingredients/no-steps one-liners stay (they are correct at that size). Settings has no empty state (defaults always render). |
| Design gate | Two board pins (ES1 pattern, ES2 per-screen copy) in the next board round. |

Zero schema changes. Zero new npm dependencies. Small milestone by design — a good first run for the M9-M15 rhythm.

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd.
2. **Never**: commit, push, merge, install/upgrade dependencies, change schema, or touch live data.
3. **No hardcoded hex/font/spacing** — tokens only; new classes documented in `docs/design-system.md`.
4. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
5. **Batch-Read before editing:** `app/page.tsx` (the tonight-card-empty pattern), `app/recipes/page.tsx`, `app/grocery/page.tsx`, `app/plans/page.tsx`, `app/globals.css` (tonight-card styles), `components/status-message.tsx`.
6. Baseline before starting AND before done: `npm run typecheck && npm run test && npm run lint`.
7. `rtk` proxies shell commands; rerun as `rtk proxy <cmd>` if truncated.

**STOP points:** ① ES1/ES2 board verdicts before merge; ② before ANY commit; ③ senior `/code-review` before merge.

Branch: `codex/empty-states`. One PR.

---

## 3. Phase 1 — the shared component

`components/empty-state.tsx`:

```tsx
import type { ReactNode } from "react";

// Shared empty-state panel (milestone 15) — the Today screen's
// tonight-card-empty pattern, generalized. Presentational only.
export function EmptyState({
  label,
  heading,
  body,
  children,
}: {
  label: string;
  heading: string;
  body?: string;
  children?: ReactNode; // action buttons/links, already styled by the caller
}) {
  return (
    <div className="empty-state">
      <p className="empty-state-label">{label}</p>
      <h2>{heading}</h2>
      {body ? <p className="empty-state-body">{body}</p> : null}
      {children ? <div className="empty-state-actions">{children}</div> : null}
    </div>
  );
}
```

CSS (`app/globals.css`, adjacent to the tonight-card styles; mirror their token usage — read them first and reuse their values via the same tokens, not copied literals):

```css
/* Shared empty state (milestone 15) — generalizes .tonight-card-empty */
.empty-state {
  background: var(--color-surface-muted);
  border: 1px dashed var(--line);
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}
.empty-state-label {
  margin: 0;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.empty-state h2 { margin: 0.35rem 0 0; font-size: 1.15rem; }
.empty-state-body { margin: 0.4rem 0 0; color: var(--muted); font-size: 0.92rem; }
.empty-state-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  margin-top: 0.9rem;
  flex-wrap: wrap;
}
```
If the board pin (ES1) adjusts the treatment, apply the verdict. Compare against `.tonight-card-empty` before finalizing — if its actual radius/padding tokens differ from the above, MATCH THE EXISTING PATTERN and note the correction in the PR.

---

## 4. Phase 2 — per-screen replacements (copy is exact; no em-dashes)

| Screen | Replaces (pre-edit) | EmptyState props + actions |
|---|---|---|
| Recipes, none at all | `app/recipes/page.tsx:146` `<p>No recipes yet.</p>` | label `Recipes`, heading `No recipes yet`, body `Add your first recipe by hand, or import one from a website or pasted text.` Actions: the page's existing "New recipe" and "Import" buttons' handlers (reuse the same onClick/href wiring; `primary-btn` for New recipe, `secondary-btn` for Import). |
| Recipes, search empty | `app/recipes/page.tsx:147` `<p>No recipes match your search.</p>` | label `Search`, heading `Nothing matches`, body `No recipe names contain "{query}". Try fewer letters.` One action: `secondary-btn` "Clear search" → `setQuery("")`. |
| Shop, no plan | `app/grocery/page.tsx:134-136` muted one-liner | label `Shop`, heading `Nothing to shop yet`, body `Plan the week first, then generate the grocery list from it.` One action: `primary-btn` link to `/plans`, text `Open the plan`. |
| Plan, no plans in view | `app/plans/page.tsx:166-168` muted one-liner | label `Plan`, heading `No plans in this view`, body `Create a plan to start the week.` One action: `primary-btn` "New plan" wired to the page's existing create-sheet opener (`setShowCreate(true)` or the page's actual handler — read it first). |

Rules:
- The `{query}` interpolation uses the live `query` state, trimmed.
- Keep every conditional guard EXACTLY as it is today (`!loading && ...` shapes) — only the rendered element changes.
- The recipes count line (`app/recipes/page.tsx:132`) stays.
- Shop's in-list empties (`Nothing to buy.` / `No pantry staples to check.`, lines 157/163) stay as-is — they are bucket-level, not page-level.
- If milestone 13 (plan copy) merged first, the Plan empty state's "New plan" opens the same sheet that now contains "Start from" — no extra work, just verify.

---

## 5. Phase 3 — board pins

Follow `scripts/review-board/README.md`; redeploy to the EXISTING artifact URL. Shots at 390px with seeded-empty accounts (the reviewer-account pattern; wipe its data locally per the harness reset script if one exists, otherwise a fresh local user).

| Pin | Mock | Question |
|---|---|---|
| ES1 | The four EmptyState instances as coded (dashed border, centered) vs a left-aligned flat variant | Which pattern? |
| ES2 | The copy table in §4 as rendered | Any wording changes? |

---

## 6. Verification

1. typecheck / test / lint / `npm run build` green.
2. Local manual pass with an empty account: all four states render with working actions; then add data and confirm each disappears.
3. Playwright probe (small, clone the house harness pattern): fresh user → Recipes shows the empty state, tap New recipe → editor opens; search `zzz` on a populated account → search-empty renders, Clear search restores the list; Shop with no plan → CTA navigates to `/plans`; Plan view empty → New plan opens the create sheet. ~8 assertions.
4. Existing harnesses still green: `verify-recipes-pass.mjs` 22/22, `verify-import-pass.mjs` 26/26 (the recipes page was edited).
5. If milestone 14 (dark mode) has merged: eyeball all four states in dark scheme during the probe run (`colorScheme: "dark"`); token-only styling should make this automatic.

**Acceptance:**
- The four weak empty states use the shared pattern with the approved copy; every CTA works.
- All other empty states and all populated-state rendering byte-identical.
- No schema/dep changes; vitest ≥128 green.

## 7. Do-not-touch list

`supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, `app/page.tsx` empty cards (reference pattern, not a target), recipe-detail one-liners, Shop bucket-level empties, `lib/hooks/**` (this is presentation-only).
