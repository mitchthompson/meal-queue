# Milestone 10: Responsiveness (Shop stale banner + optimistic writes) — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask.

---

## 1. Context (why)

Two long-standing feel issues, one milestone, **two PRs in this order**:

- **PR 1 — Shop stale banner.** The Shop page silently regenerates the grocery list on load whenever `meal_plans.groceries_version !== version` (`lib/hooks/use-grocery-list.ts:122-133`). Milestone 4 made this harmless to user state, but it is illegible: the list changes with no explanation. Replace the silent write with a visible banner + explicit button.
- **PR 2 — optimistic writes.** No hook updates local state before its `await` resolves (verified 2026-07-05). Every tap pays a full round trip, and plan mutations pay a second one (refetch) before the UI moves. On the phone this reads as sluggish.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Staleness UX | Banner + explicit button (option A). List stays usable while stale; NO auto-regeneration on load, ever. |
| Optimistic scope | "Everything client-writable" — the per-mutation treatment table in §5 is the binding interpretation: item-level mutations are truly optimistic (apply-then-rollback); form-level saves keep their transaction but lose blocking refetches. |
| Failure UX | On write failure: state reverts and the existing red `StatusMessage` shows the (already-mapped) error. No toasts, no new primitives. |
| Concurrency | Single-household app: last-write-wins is accepted. Use functional `setState` everywhere; no mutation queues. |
| Design gate | One board pin (SB1: banner treatment) in the next board round; PR 2 has no visual surface and needs no pins. |

Zero schema changes. Zero new npm dependencies. **Build AFTER milestone 9** (the error sweep touches the same hooks; rebasing optimistic patches over the sweep is harder than the reverse).

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd.
2. **Never**: commit, push, merge, install/upgrade dependencies, change `supabase/schema.sql` or `supabase/migrations/`, or touch live Supabase data.
3. **No hardcoded hex/font/spacing** — CSS tokens only; new classes documented in `docs/design-system.md`.
4. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
5. **Batch-Read before editing:** `lib/hooks/use-grocery-list.ts`, `lib/hooks/use-plan.ts`, `lib/hooks/use-recipes.ts`, `app/grocery/page.tsx`, `app/plans/page.tsx`, `components/plan-day-items.tsx`, `components/status-message.tsx`, `app/globals.css` (the shop styles ~1200-1360), `scripts/verify-import-pass.mjs` (as the harness pattern to clone).
6. Baseline before starting AND before declaring done: `npm run typecheck && npm run test && npm run lint` (vitest ≥128 green).
7. `rtk` proxies shell commands; rerun as `rtk proxy <cmd>` if output looks truncated.

**STOP points:** ① SB1 board verdict before PR 1 merges; ② before ANY commit; ③ senior `/code-review` on each PR before merge.

---

## 3. PR 1 — `codex/shop-stale-banner`

### 3a. Hook changes (`lib/hooks/use-grocery-list.ts`)

1. Add state: `const [stale, setStale] = useState(false);` next to the existing flags (lines 36-39).
2. Replace the silent-regeneration block (lines 122-133, quoted below) with a staleness computation:
   ```ts
   // BEFORE (delete):
   if (options?.skipStaleCheck) return;
   const plan = plans.find((value) => value.id === planId);
   if (!plan) return;
   if (plan.groceries_version !== plan.version) {
     await regenerate(plan, true);
   }
   ```
   ```ts
   // AFTER:
   if (options?.skipStaleCheck) return;
   const plan = plans.find((value) => value.id === planId);
   if (!plan) return;
   // Milestone 10: staleness is surfaced as a banner, never auto-regenerated.
   setStale(plan.groceries_version !== plan.version);
   ```
3. `regenerate` (lines 135-161): remove the `silent` parameter entirely — the only silent caller was the block above. Always set the success message (`"Grocery list regenerated from current meal plan."`, unchanged). After the successful local version stamp (lines 152-154), add `setStale(false);`.
4. Also `setStale(false)` when `loadGroceryItems` runs with `skipStaleCheck` — no: leave it; the explicit `setStale(false)` in `regenerate` covers the only path. Do not add other writers of `stale`.
5. Return `stale` from the hook.

### 3b. UI (`app/grocery/page.tsx`)

Render the banner between the `StatusMessage` (line 132) and the loading line (line 133), only when `stale && selectedPlan && !loading`:

```tsx
{stale && selectedPlan && !loading ? (
  <div className="shop-stale-banner" role="status">
    <p>
      {hasList
        ? "Your meal plan changed since this list was made."
        : "This plan doesn't have a grocery list yet."}
    </p>
    <button
      className="shop-stale-btn"
      disabled={regenerating}
      onClick={() => regenerate(selectedPlan)}
      type="button"
    >
      {regenerating ? "Updating..." : hasList ? "Update list" : "Generate list"}
    </button>
  </div>
) : null}
```
where `hasList` = `items.length > 0` (a `const` above the return). Copy strings exactly as written.

The existing "Regenerate" button (lines 107-114) stays — it is the manual re-run for when the banner is absent. Adjust its `onClick` for the removed `silent` param only if the signature changed (it should now be `regenerate(selectedPlan)` — likely already is).

### 3c. CSS (`app/globals.css`, with the shop styles)

```css
/* Shop staleness banner (milestone 10) — amber callout, list stays usable */
.shop-stale-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: var(--color-accent-soft);
  color: var(--color-accent-deep);
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
}
.shop-stale-banner p { margin: 0; font-size: 0.92rem; }
.shop-stale-btn {
  min-height: 44px;
  padding: 0 0.9rem;
  border: none;
  border-radius: 8px;
  background: var(--color-accent-deep);
  color: var(--color-surface);
  font-weight: 600;
  white-space: nowrap;
}
```
The `10px`/`8px` radii and `0.92rem` follow the existing import-callout scale; if the board pin (SB1) changes the treatment, apply the verdict. Document both classes in `docs/design-system.md`.

### 3d. Board pin SB1

Follow `scripts/review-board/README.md` (local app, reviewer account, 390px, redeploy to the EXISTING artifact URL — never a new link). One pin: the banner as coded (amber) vs a neutral variant (`--color-surface-muted` bg, `--muted` text). Question: "Amber urgency or quiet neutral?" Verdict gates merge, not build.

### 3e. Verification (PR 1)

1. typecheck / test / lint / build green.
2. New harness `scripts/verify-shop-pass.mjs`, cloned from the `verify-import-pass.mjs` pattern (local stack, seeded reviewer data, Playwright): assert (a) fresh plan with items but no list → "Generate list" banner; (b) generate → list rows appear, banner gone; (c) check two items, then add a cook meal to the plan via the Plan page; return to Shop → "Update list" banner, list unchanged, checks intact; (d) tap Update → banner gone, new item present, **the two checks survived** (this is the M4 state-preservation guarantee, now user-triggered); (e) no console errors. Target ~12-16 assertions.
3. Manual: confirm NO regeneration fires on Shop load while stale (network tab: no `regenerate_grocery_list` RPC until the button).

---

## 4. PR 2 — `codex/optimistic-writes` (build after PR 1 merges)

### 4a. The one pattern (use everywhere)

```ts
async function mutate(...) {
  setError(null);
  const snapshot = items;                       // capture BEFORE patching
  setItems((current) => /* patched copy */);    // 1. optimistic local patch
  const { error } = await supabase...;          // 2. the write
  if (error) {
    setItems(snapshot);                         // 3. rollback
    setError(toErrorMessage(error, "<existing fallback>"));
    return;
  }
  // 4. success: reconcile if the function previously refetched (see table)
}
```
Rules: snapshot the exact state slices you patch; rollback restores all of them; never `await` between snapshot and patch; keep every existing message/fallback string byte-identical (milestone 9 already routed them through `toErrorMessage`).

### 4b. Per-mutation treatment table (binding)

| Hook / site | Function (pre-edit lines) | Treatment |
|---|---|---|
| `use-grocery-list.ts` | `toggleChecked` (164-174) | Optimistic: patch `is_checked` before await; rollback on error. Delete the post-await patch. |
| `use-grocery-list.ts` | `setCheckedForBucket` (176-188) | Optimistic, same shape (patch all ids). |
| `use-grocery-list.ts` | `movePantryToMain` (190-200) | Optimistic (`is_pantry_staple: false`). |
| `use-grocery-list.ts` | `setOnHand` (202-212) | Optimistic (`is_on_hand`). |
| `use-grocery-list.ts` | `regenerate` | UNCHANGED (a regeneration is a real wait; the `regenerating` flag is honest). |
| `use-plan.ts` | `adjustServing` (464-486) | Optimistic: patch the item's `serving_multiplier` (same clamp math) before await; rollback on error. On success keep `refreshPlansAndKeepSelection` (version freshness) but DROP the `loadPlanItems` refetch — the local patch is already the truth. Keep the success message. |
| `use-plan.ts` | `removeItem` (421-438) | Optimistic: filter the item out of `items` before await; rollback on error. On success keep `refreshPlansAndKeepSelection`, drop `loadPlanItems`. |
| `use-plan.ts` | `addMeal` (349-419) | Optimistic with temp id: build a local `MealPlanItem` (`id: \`optimistic-${Date.now()}\``, fields from the args; `recipe` object looked up from the hook's `recipes` state for cook slots, from the source item's recipe for leftovers, `null` for eat-out), append before await. Change the insert to `.select("id").single()` and on success swap the temp id for the real id in place; keep `refreshPlansAndKeepSelection`, drop the full `loadPlanItems`. On error remove the temp item. Keep the range guard (369-371) BEFORE the optimistic append. |
| `use-plan.ts` | `createPlan`, `savePlanMeta`, `deleteSelectedPlan` | UNCHANGED (sheet-based, rare, confirm-gated). Locked decision. |
| `use-recipes.ts` | `saveRecipe` (245-270) | Reduced-latency confirm: after `saveRecipeForm` resolves, replace `await loadData(); ...; await selectRecipe(recipeId);` with a local patch of `recipes` (update the row if `form.id` matched, else prepend `{ id: recipeId, name, base_servings: Number(form.base_servings \|\| 2), instructions_raw: form.instructions_raw }`) and `setForm((c) => ({ ...c, id: recipeId }))`. Keep `setShowEditor(true)` and the `"Recipe saved."` message. The RPC await itself stays (atomic validation is the point). Tags added during save won't appear in `knownTags` until next full load — acceptable, note in PR. |
| `use-recipes.ts` | `deleteRecipe` (272-286) | Replace the fire-and-forget `loadData()` (285) with a local filter of `recipes`. The delete await stays (it is confirm-gated). |
| `app/settings/page.tsx` | `saveSettings` (63-85) | UNCHANGED — already a single await with no refetch. |
| `use-import.ts` | save path | UNCHANGED (navigates on success; nothing to patch). |

**Why `saveRecipeForm` itself is untouched:** it is the shared C1 seam proven neutral by `verify-recipes-pass.mjs`; both callers change around it, never through it.

### 4c. Interaction notes (read carefully)

- `plan-day-items.tsx` needs NO changes: props re-render from the hooks' state.
- The Shop `uncheckedCount` (`app/grocery/page.tsx:43-46`) derives from `items` — it now moves instantly with optimistic checks. Expected.
- Milestone 10 PR 1's `stale` flag: optimistic plan mutations still trigger the DB version bump, so the banner appears on the next Shop visit via fresh `loadPlans`. No extra wiring.
- Rapid stepper taps on servings: each click reads the freshly-rendered `item.serving_multiplier`, so sequential ±0.25 steps accumulate correctly. Concurrent races are accepted (locked decision).

### 4d. Verification (PR 2)

1. typecheck / test / lint / build green; vitest ≥128.
2. Re-run `node scripts/verify-recipes-pass.mjs` (22/22 — proves the recipe save path still round-trips), `node scripts/verify-import-pass.mjs` (26/26), and `node scripts/verify-shop-pass.mjs` (PR 1's harness — checks still survive regeneration).
3. Extend `verify-shop-pass.mjs` (or add `verify-optimistic-pass.mjs` cloned from it) with a latency probe: use Playwright route interception to delay all `rest/v1/grocery_list_items` responses by 1500ms, tap a check, assert the checkbox renders checked in <200ms and no error shows; then abort a request (route.abort) and assert the checkbox reverts AND the red StatusMessage appears. Same probe shape for a plan `removeItem`. Target ~10 assertions.
4. Manual on the local stack: add a meal → row appears instantly; check network shows insert + plans refresh only (no full item refetch).

**Acceptance (milestone):**
- Shop never writes on load; staleness is always visible and user-resolved; checked/on-hand/pantry state survives a banner-triggered update (harness-proven).
- Every table-row mutation renders its result in <200ms under a 1500ms-delayed network (harness-proven) and rolls back visibly on failure.
- All existing messages, fallbacks, and behaviors otherwise byte-identical.

## 5. Do-not-touch list

`supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, `lib/hooks/use-today.ts` (read-only hook), `components/recipe-import.tsx`, `saveRecipeForm` in `lib/hooks/use-recipes.ts`.
