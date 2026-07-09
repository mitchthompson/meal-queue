# UX Feedback Fixes (post-use, 2026-07-07)

Owner feedback after real use of the app. Three independent issues, all on
`main` (live). Decisions collected 2026-07-07. This is a builder-ready spec.

Baseline at spec time: `codex/password-reset` holds committed-but-unpushed M11
(set aside); these fixes should be built on a **fresh branch off `main`**
(`cc1e6ec`), not on the M11 branch.

---

## Issue 1 — Today CTAs land on the wrong plan / wrong intent

**Symptom:** On Today, "Open plan" (under *Next week*) and the "Plan it" /
"Plan the week" CTAs don't go where expected.

**Root cause:** every Today CTA is a bare `<Link href="/plans">`
([app/page.tsx](../../app/page.tsx) lines 103, 133, 160, 175) with no plan
identity or intent. `/plans` always forces `planFilter = "current"` and selects
the current-week plan ([use-plan.ts](../../lib/hooks/use-plan.ts) L168–175), so
"Open plan" under *Next week* opens **this** week, and the "Plan" CTAs drop you
on an existing/empty plan view instead of a create flow. Neither `/plans` nor
`/grocery` reads a plan id from the URL — no deep-linking exists yet.

**Decision:** add deep-link params and point each CTA at the right one.

**Build:**
1. `/plans` reads `useSearchParams()` (mirror the recipes page convention):
   - `?plan=<id>` → set `planFilter` to `"all"` (so the plan is always in
     `visiblePlans` and the reset effect at L168–175 won't clobber it) and
     `setSelectedPlanId(id)`. Strip the param after applying via
     `router.replace("/plans", { scroll: false })` (mirror `?edit`/`?import`).
   - `?new=1` → open the create sheet (`setShowCreate(true)`), same strip.
2. Today CTAs ([app/page.tsx](../../app/page.tsx)):
   - *Next week* card "Open plan" (nextPlan exists) → `/plans?plan=${nextPlan.id}`.
   - *Next week* "Plan it" (no nextPlan) → `/plans?new=1`.
   - Empty "No meal plan" → "Plan the week" → `/plans?new=1`.
   - "Open the plan" (nothing planned tonight, currentPlan exists) →
     `/plans?plan=${currentPlan.id}` (keeps you on the plan you're looking at).
   - "plan →" week-row pills → leave as `/plans` (current plan is correct there).

**Edge:** `?new=1` should not fight the filter-reset effect. Create-sheet open
is independent of selection, so no conflict.

---

## Issue 2 — Inline quick-add fights the iOS keyboard

**Symptom:** adding a recipe to a plan is painful on iPhone — the keyboard
shifts the viewport, the results list is hard to see, the page jumps around.

**Root cause:** the quick-add card renders **inline inside the day row**
([plan-day-items.tsx](../../components/plan-day-items.tsx) L124–231) and
autofocuses the search input ([use-plan.ts](../../lib/hooks/use-plan.ts)
L177–179). On iOS the keyboard raises immediately, shifts the viewport, and
because results render inline in a long scrolling day list, the page reflows.

**Decision:** replace the inline card with a **full-screen takeover**
(same pattern as the Cook-mode / recipe-editor mobile takeover).

**Build:**
1. New `components/plan-add-meal.tsx` — a full-screen takeover, opened when
   `activeDay` is set. Reuses the Cook-mode container recipe:
   `position: fixed; inset: 0`, z-index above the `.mobile-tabbar` (z-20), and
   `document.body.style.overflow = "hidden"` on mount / restore on unmount
   (copy the effect from [cook-mode.tsx](../../components/cook-mode.tsx) L59–62).
2. It consumes the **same props** `PlanDayItems` passes today (the quick-add
   state machine stays in `usePlan` — no logic move): `quickMode/setQuickMode`,
   `quickQuery/setQuickQuery`, `quickNote/setQuickNote`, `quickLeftoverId`,
   `quickInputRef`, `quickMatches`, `quickLeftoverOptions`,
   `handleQuickAddKeyDown`, `addMeal`, `activeDay`.
3. Layout: header row shows "Add to \<day\>" + a Back/close (`✕`) that calls
   `setActiveDay(null)`; the mode pills (Cook / Leftovers / Eating out); then the
   mode body (search input + results / leftover select / eat-out note). Results
   list scrolls **inside** the takeover, not the page.
4. Preserve all existing behavior: recents-first ordering (`quickMatches`),
   Enter = add top match, Shift+Enter = add and jump to next day
   (`handleQuickAddKeyDown` already does this), the three modes.
5. `PlanDayItems` keeps only the "+"/"add another meal" triggers (they still call
   `openQuickAdd(day)`); the inline `isActive` card block (L124–233) is removed —
   the takeover renders once at the page level driven by `activeDay`.
6. Autofocus: keep focusing `quickInputRef` on open (fine inside a takeover since
   the page can't jump), but the takeover is fixed so the keyboard no longer
   reflows content.
7. CSS: new `.plan-add-*` classes in `app/globals.css` built from existing
   tokens (reuse the takeover tokens referenced at globals.css L26). No hardcoded
   values; flag any missing token in design-flags.md.

**Note:** this departs from the original reflow "inline quick-add" decision
(2026-07-02). Owner explicitly approved the takeover on 2026-07-07 — record in
decisions.md.

---

## Issue 3 — "Generate grocery list" generates nothing, wrong plan

**Symptom:** the button at the bottom of the plan screen doesn't go to that
plan's grocery list and doesn't generate one. Poorly named.

**Root cause:** [app/plans/page.tsx](../../app/plans/page.tsx) L288–292 is a
plain `<Link href="/grocery">` — no plan id (so `/grocery` shows whatever's
"current"), and no generation. The real generate action already lives on the
Shop page (the amber "Generate list" / "Update list" banner, M10 PR1).

**Decision:** rename + deep-link only. Generation stays on the Shop page.

**Build:**
1. Rename the button to **"Shop this plan"** and change it to
   `/grocery?plan=${selectedPlan.id}`.
2. `/grocery` reads `useSearchParams()` `?plan=<id>` → `setSelectedPlanId(id)`
   (via the hook's `selectPlan`), strip the param after applying. If a stale
   plan is opened, the existing amber banner already offers Generate/Update —
   that's the intended one-tap generate path.
3. **Edge:** `useGroceryList.loadPlans` only loads plans with `end_date >= today`
   ([use-grocery-list.ts](../../lib/hooks/use-grocery-list.ts) L76–106). A
   deep-linked **past** plan won't be in the set, so selection would no-op. Since
   "Shop this plan" is reachable for any selected plan (incl. Past filter),
   either (a) accept that shopping a past plan isn't supported (simplest — past
   plans rarely get shopped), or (b) have `loadPlans` also fetch the `?plan` id
   when it falls outside the window. **Recommend (a)** unless the owner wants
   past-plan shopping; note the limitation.

---

## Adversarial-review fixes (2026-07-08)

A 5-lens adversarial review pass (each finding re-checked by a second agent
trying to refute it) surfaced **4 confirmed issues**, all fixed on this branch:

1. **`?new=1` create-sheet flicker** (edge). When a current AND a future plan
   coexist, the load-time selection bounce (`loadedPlans[0]` → current-filter
   plan) re-fired the plan page's sheet-closing effect and clobbered the freshly
   opened create sheet. Only reachable via a bookmarked/hand-typed
   `/plans?new=1` (the app's own CTAs never emit `?new=1` in that state). **Fix:**
   `usePlan.loadInitialData` now selects the plan the default "current" filter
   settles on, removing the bounce entirely (also drops a redundant re-render on
   every normal load with a future plan). Verified live: `/plans?new=1` opens the
   sheet and it stays open under the exact precondition.
2. **"Shop this plan" from a past plan** (edge). The Shop page only loads
   current+upcoming plans, so deep-linking a past plan silently landed on the
   default week. **Fix:** the button is gated on `selectedPlan.end_date >= today`,
   so it simply doesn't render for past plans (no misfire). Supersedes the earlier
   "accept the limitation" note.
3. **Takeover not a focus trap** (a11y). Tab/Shift+Tab escaped to the controls
   behind the opaque overlay. **Fix:** `plan-add-meal.tsx` traps Tab within the
   dialog (self-contained; AppShell nests the takeover in `<section>`, so an
   in-component trap is cleaner than shell-wide `inert`).
4. **Focus not restored on close** (a11y). Closing dropped focus to `<body>`.
   **Fix:** `usePlan` captures the triggering control in `openQuickAdd` and an
   effect restores focus on the set→null transition (ignores the A→B day jump).

## Verification

- `npm run typecheck`, `npm run test` (138/138), `npm run build`.
- A `scripts/review-board/verify-*.mjs` Playwright pass driving: Today CTA →
  correct plan/create-sheet; add-meal takeover opens, searches, adds (cook +
  leftover + eat-out), Shift+Enter next-day; "Shop this plan" → correct plan on
  /grocery with the stale banner when applicable.
- Real-device pass (Needs-Mitchell): the whole point of #2 is iOS keyboard
  behavior — must be checked on real iPhone Safari (Playwright WebKit ≠ Safari).

## Docs to update on wrap

- `docs/pages/plans.md` (add-meal takeover replaces inline quick-add),
  `docs/pages/today.md` (deep-link CTAs), `docs/routes.md` (`?plan`/`?new`
  params), `docs/decisions.md` (takeover supersedes inline quick-add),
  `docs/current-state.md`, `docs/progress-log.md`.
</content>
</invoke>
