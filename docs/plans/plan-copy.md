# Milestone 13: Plan copy ("Start from a previous week") — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask.

---

## 1. Context (why)

The household plans similar weeks. Quick-add recents (`use-plan.ts:126-136`) surface the rotation one recipe at a time; there is no way to start a new week from a previous one.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Approach | Copy-a-previous-plan at creation time. NO templates table, NO schema change (locked 2026-07-05 over the templates-table option). |
| Surface | One `<select>` in the existing create-plan sheet: "Start from" — default "Empty plan", plus the 8 most recent plans labeled by week. |
| Date mapping | Item dates shift by (new start − old start). Items that land past the new plan's end are SKIPPED and counted, never clamped. |
| Leftover links | Remapped to the copied counterpart. A leftover whose source cook item was skipped is itself skipped (the DB validation trigger would reject it anyway — `supabase/schema.sql:505-530`). |
| Atomicity | Two bulk inserts (non-leftovers, then leftovers). Each bulk insert is one statement (atomic); a failure between them leaves a partial copy with an honest message. Accepted for a single-household app. |
| Design gate | One board pin (PC1: the select in the create sheet) in the next board round. |

Zero schema changes. Zero new npm dependencies. `meal_type` stays hardcoded `"dinner"` like every other insert (vestigial NOT NULL column — `use-plan.ts:382-385`).

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd.
2. **Never**: commit, push, merge, install/upgrade dependencies, change schema, or touch live Supabase data.
3. **No hardcoded hex/font/spacing** — tokens only.
4. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
5. **Batch-Read before editing:** `lib/hooks/use-plan.ts` (whole file), `app/plans/page.tsx`, `lib/date-utils.ts`, `supabase/schema.sql` lines 99-120 + 505-560 (item constraints and triggers — the copy MUST satisfy them), `docs/pages/` plan stub if present.
6. Baseline before starting AND before done: `npm run typecheck && npm run test && npm run lint` (vitest ≥128).
7. `rtk` proxies shell commands; rerun as `rtk proxy <cmd>` if truncated.

**STOP points:** ① PC1 board verdict before merge; ② before ANY commit; ③ senior `/code-review` before merge.

Branch: `codex/plan-copy`. One PR. Build AFTER milestone 10 (it edits `createPlan`, which M10 explicitly left pessimistic — keep it pessimistic here too).

---

## 3. Phase 1 — pure date/mapping helpers (`lib/plan-copy.ts`, new, fully vitest-covered)

New file so the mapping logic is testable without Supabase. Exports:

```ts
export type CopySourceItem = {
  id: string;
  plan_date: string;            // YYYY-MM-DD
  slot_type: "cook" | "leftover" | "eat_out";
  recipe_id: string | null;
  leftover_from_item_id: string | null;
  note: string | null;
  serving_multiplier: number;
};

export type PlannedCopy = {
  rows: Array<Omit<CopySourceItem, "id" | "leftover_from_item_id"> & { source_id: string; source_leftover_from: string | null }>;
  skippedOutOfRange: number;    // items whose shifted date passed the new end
  skippedOrphanLeftovers: number; // leftovers whose source cook item was skipped
};

export function planCopy(
  sourceItems: CopySourceItem[],
  sourceStart: string,          // old plan start_date
  newStart: string,
  newEnd: string,
): PlannedCopy;
```

`planCopy` behavior (exact):
1. `offsetDays = daysBetween(sourceStart, newStart)` — reuse/extend `lib/date-utils.ts` helpers (`addDays` exists; add `daysBetween` there if missing, with tests).
2. Shift every item's `plan_date` by `offsetDays`. Drop items with shifted date > `newEnd` (count into `skippedOutOfRange`). Shifted dates before `newStart` are impossible by construction (same offset applied to all; source items are ≥ sourceStart) — assert this in a test anyway.
3. Drop leftover items whose `leftover_from_item_id` refers to a dropped (or missing) source item; count into `skippedOrphanLeftovers`.
4. Rows carry `source_id` and `source_leftover_from` so the insert phase can remap ids.

Vitest (`lib/plan-copy.test.ts`): straight copy (7-day → 7-day, all fit); shorter target (14-day → 7-day, back half skipped, counts right); leftover chain intact when both ends fit; orphaned leftover skipped and counted; eat-out note carried; serving multipliers carried; empty source. ≥10 assertions.

---

## 4. Phase 2 — hook wiring (`lib/hooks/use-plan.ts`)

1. New state: `const [copyFromPlanId, setCopyFromPlanId] = useState<string>("");` (empty string = "Empty plan"). Expose it + its setter. Reset to `""` after a successful create and when the create sheet closes.
2. Extend `createPlan` (lines 289-318). After the existing insert succeeds and `data.id` is known, and BEFORE `refreshPlansAndKeepSelection`:
   ```ts
   let copySummary: string | null = null;
   if (copyFromPlanId) {
     copySummary = await copyPlanItems(copyFromPlanId, data.id, createForm.start_date, createForm.end_date);
   }
   ```
   Success message becomes `copySummary ?? "Meal plan created."`.
3. New private `copyPlanItems(sourceId, targetId, newStart, newEnd): Promise<string>`:
   a. Load the source plan's `start_date` and items: `meal_plan_items.select("id, plan_date, slot_type, recipe_id, leftover_from_item_id, note, serving_multiplier").eq("meal_plan_id", sourceId)`.
   b. `const planned = planCopy(items, sourceStart, newStart, newEnd);`
   c. **Insert wave 1** — every planned row whose `slot_type !== "leftover"`, one bulk `insert([...]).select("id")` with `meal_type: "dinner"`, mapping fields directly. Build `idMap: source_id → new id` by array position (Supabase preserves insert order in the returned rows; still, defensively match by position AND assert equal lengths).
   d. **Insert wave 2** — leftover rows, `leftover_from_item_id: idMap.get(row.source_leftover_from)`; any row whose mapping is missing is skipped and counted with the orphans.
   e. Failure handling: wave-1 error → throw (caller's catch shows `toErrorMessage(err, "Failed creating plan.")` — the plan exists but empty; acceptable). Wave-2 error → return the summary string with the suffix `"Leftovers couldn't be copied. Add them by hand."` instead of throwing.
   f. Return summary. Copy templates (exact, no em-dashes):
      - all copied: `Copied {n} meals from the week of {formatDate(sourceStart)}.`
      - some skipped: `Copied {n} meals from the week of {formatDate(sourceStart)}. {m} didn't fit the new dates.`
      - `formatDate` = the existing shared date formatter used on the Plan page (from milestone 6's `lib/date-utils.ts` formatters — reuse, do not add a new format).
4. `version` bumps fire per inserted cook row via the DB trigger — expected; the Shop banner (M10) will offer the list update. Do not add regeneration calls here.

---

## 5. Phase 3 — UI (`app/plans/page.tsx`, create sheet)

In the create form (around lines 173-215), add a labeled select ABOVE the submit button, following the exact label/select idiom of the settings rows:

```tsx
<label className="settings-row">
  Start from
  <select
    value={copyFromPlanId}
    onChange={(event) => setCopyFromPlanId(event.target.value)}
  >
    <option value="">Empty plan</option>
    {copySourcePlans.map((plan) => (
      <option key={plan.id} value={plan.id}>
        Week of {formatDate(plan.start_date)}
      </option>
    ))}
  </select>
</label>
```
`copySourcePlans` = the hook's existing `plans` sorted by `start_date` descending, sliced to 8, exposed from the hook (a `useMemo`). If the class idiom differs in this sheet (check the neighboring fields first), match the sheet's existing field classes instead — the sheet's own idiom wins over the snippet above.

The submit button keeps its `disabled={saving}` and label swap; no other create-sheet changes.

---

## 6. Verification

1. typecheck / lint / build green; vitest grows by the new `plan-copy` suite (≥138 total).
2. Local-stack manual pass (dev server + seeded data):
   - Create from a source week where everything fits → items appear on the right days, message reads `Copied N meals from the week of ...`.
   - Create a SHORTER week from a longer source → skip count correct, no items past the end.
   - Source with a leftover chain: both copied, the leftover points at the copied cook item (inspect `leftover_from_item_id` via the local DB), and the detail renders on the Plan page.
   - Eat-out note carried verbatim.
   - "Empty plan" (default) → behavior byte-identical to today.
3. DB triggers prove the copy is legal: no `validate_meal_plan_item` or range-trigger errors in any pass above.
4. Playwright probe (extend the plan section of any existing harness or a small new `verify-plan-copy-pass.mjs` cloned from the house pattern): the four manual cases above as assertions (~12).
5. Shop follow-through: after a copy, the Shop page shows the M10 stale banner (version bumped) — one assertion.

**Acceptance:**
- A new week can start from any of the last 8 plans with one extra tap.
- Date shifts, skips, and leftover remapping match the vitest-proven mapping exactly.
- Empty-plan creation is unchanged.
- No schema change, no new deps; `createPlan` stays pessimistic.

## 7. Do-not-touch list

`supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, quick-add logic in `use-plan.ts` (488-527), `components/plan-day-items.tsx`.
