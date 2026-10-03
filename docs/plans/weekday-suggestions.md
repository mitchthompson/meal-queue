# Milestone 17: Weekday suggestions + Add the usuals (build spec for handoff)

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and report to the orchestrator. Where a value or behavior is not specified here, do NOT invent it: STOP and ask (never write to `docs/`).

Drafted 2026-10-02 against `main` at `0dcabab`; every file:line below was checked against that commit. Final home: `docs/plans/weekday-suggestions.md` (linked from roadmap M17). Branch `codex/weekday-suggestions`. One PR. Supersedes milestone 13 (plan copy, dropped 2026-10-02).

---

## 1. Context (why)

Owner request (2026-10-02): some weeks the household cooks the same thing on the same day, beans on Sunday and chicken on Thursday. When adding a recipe to that day, that recipe should be suggested.

Prod evidence (read-only, 2026-10-02): plans cover 33 weeks since 2026-02-14 with 185 cook items. Crispy Chicken Thighs was cooked on all 31 Thursdays that had a cooked meal; Hurst 15-Bean Soup on 24 of 29 Sundays; Friday has two fish recipes at 7 each out of 18 Fridays. Every cook item has `serving_multiplier` 1.

Today the add-meal takeover (`components/plan-add-meal.tsx`) ranks the Cook list by recency only (`quickMatches`, `lib/hooks/use-plan.ts:130-140`, fed by the 200-row recency query at `use-plan.ts:217-222`). It knows nothing about weekdays, and nothing on the Plan page fills a week from habits.

**Owner decisions (locked 2026-10-02, do not revisit):**

| # | Decision | Choice |
|---|---|---|
| 1 | Habit rule | A recipe is a weekday habit when it was cooked (`slot_type = 'cook'`) on that weekday in at least 3 of the last 8 occurrences of that weekday. "Occurrence" and the lookback window are pinned in §2 (R3, R4). |
| 2a | Suggestions | In the add-meal takeover, Cook mode: a "Usually on <Weekday>s" group above the search results showing that day's habit recipes, capped (§2 R7). |
| 2b | Add the usuals | A one-tap "Add the usuals" action on the Plan page that places the applicable habit recipes on their weekdays within the selected plan (which days and recipes: §2 R9 and fork F1). |
| 3 | Guardrails | Zero schema changes, zero new npm deps, tokens-only CSS, no em-dashes in any UI copy (use commas, colons, periods), Conventional Commits, the builder never commits. |
| 4 | Design gate | One board round, pins WS1-WS4 (the group's look; Add the usuals placement, look, and feedback). The owner reviews real screenshots on the review-board artifact. Variant mocks are injected into the running app BEFORE any UI code is written. |

Neighbors: M18 (amounts in steps, retires cook mode) and M19 (Node upkeep) touch none of this milestone's files except possibly other regions of `app/globals.css`. M14 (dark mode) comes later and will sweep the new token-only CSS for free.

---

## 2. Owner forks and resolved design calls

### Owner forks (answered 2026-10-02: F1 (a) and F2 (a), both as recommended; this spec is written for them)

| Fork | Question | Options | Recommended |
|---|---|---|---|
| F1 | A weekday with two or more habits (prod: Friday's two fish recipes). What does Add the usuals put on that empty day? | (a) only the top-ranked habit; (b) every habit (two dinners that day); (c) nothing, the day is ambiguous, pick in the add screen | **(a).** (b) double-books an alternating pair; (c) gives up the one-tap win on the weekday that most needs a reminder. The add screen still shows both. Locked decision 2b says "every applicable habit recipe"; (a) reads "applicable" as one meal per empty day. |
| F2 | A habit recipe already planned on another day of the same week (chicken moved to Wednesday, Thursday empty). Add it on Thursday anyway? | (a) yes: the card's preview line names every meal before the tap; (b) skip a recipe already planned in the same 7-day block of the plan | **(a).** (b) misfires for a recipe that is a genuine habit on two weekdays, and the preview makes (a) visible before anything is written. |

If the owner picks otherwise: F1 (b) or (c) changes one line in `planUsuals` (§5 step 3) plus tests 16-18, and F1 (b) changes the card line to `{n} usual meals for empty days.`; F2 (b) adds a same-block recipe check in `planUsuals` plus one test. Build an alternative only when the orchestrator says so.

Live preview (Appendix A run read-only on prod, 2026-10-02): the rule finds exactly three habits today, one per weekday: Sunday, Hurst 15-Bean Soup (8 of 8); Thursday, Crispy Chicken Thighs (8 of 8); Friday, Garlic Butter Oven Baked Cod (4 of 8). F1 does not arise on current data; it guards the future.

### Resolved design calls (pinned by this spec; not owner questions)

- **R1. Data source: a dedicated bounded query.** Add a fifth entry to `loadInitialData`'s `Promise.all` (`use-plan.ts:206-223`): `meal_plan_items.select("plan_date, slot_type, recipe_id")` with `plan_date >= habitWindowStart(today)` and `plan_date < today`. The recency query (`use-plan.ts:217-222`) and its handling (`use-plan.ts:263-268`) stay byte-identical. Why not extend it: it drops eat-out rows (`.not("recipe_id", "is", null)`, line 220), which the occurrence rule needs; it is bounded by 200 rows of `created_at`, not by `plan_date`, so it cannot express a date window; and changing its filter or limit would change recency ranking. Cost: one extra parallel request, roughly 100-120 three-column rows at the household's pace. RLS (`supabase/schema.sql:247-260`) scopes it to the owner's plans.
- **R2. "Cooked"** means a `cook` item planned on a date before today. The app has no cooked state (design flag C2 kept it that way), so plan history is the record.
- **R3. Occurrence.** For weekday W: a date of weekday W inside the window that has at least one `meal_plan_items` row of any slot type, in any of the owner's plans. The last 8 occurrences are the 8 most recent such dates; with fewer than 8, all of them count. The bar is absolute: a habit needs at least 3 cook dates (3 of 3 qualifies, 2 of 2 does not). Why: a week with nothing planned is unknown, not evidence against a habit, so it must not dilute the count; an eat-out or leftovers-only day is evidence the habit did not happen, so it counts as a miss.
- **R4. Window: the 112 days (16 weeks) before today.** Today is excluded; the window's first day is included. Why 16 weeks: twice the 8-week base, so 8 occurrences survive up to 8 unplanned weeks (holidays, travel); a recipe dropped from the rotation four months ago cannot resurface; the query stays small. Why exclude today: suggestions stay stable all day, and nothing planned today or later can change a habit, so no refetch is needed after writes.
- **R5. Count dates, not rows.** Two chicken rows on one Thursday (or the same date in two overlapping plans) count once. Leftover rows never count as cooks.
- **R6. Ranking:** cook count descending, then last-cooked date ascending, then recipe name. The ascending tie-break serves alternating pairs: at equal counts, the one NOT cooked most recently is the one due.
- **R7. Cap: 3 suggestions.** Prod shows at most 2 habits on any weekday; 3 rows of 44px keep the search box and the first regular results visible above the iPhone keyboard.
- **R8. Takeover rules.** The group renders only in Cook mode, only while the trimmed search box is empty, and only when the active day's weekday has at least one habit (otherwise nothing renders: no heading, no empty-state copy). A typed query hides the group and leaves the list exactly as today. While the group shows, its recipes are left out of the regular list (no duplicates; the list still shows up to 8). Recipes already planned on that day (cook or leftover) are left out of the group. Enter adds the topmost visible recipe: the first suggestion when the group shows, otherwise the top match (today's behavior). Shift+Enter does the same and jumps to the next day, where the group recomputes for that weekday.
- **R9. Which days Add the usuals fills.** Days in the selected plan's SAVED range (`selectedPlan.start_date` to `end_date`, the range the database validates, `schema.sql:485-488`), on or after today, with zero items of any slot type (an eat-out or leftover day is not empty). Each such day gets its weekday's top-ranked habit (F1 a). Never a day before today (that would write fake history the rule reads back), never a second meal on an occupied day, never an overwrite.
- **R10. Visibility.** The control renders only when Add the usuals would add at least one meal, and only after the selected plan's own items have loaded (a new `itemsPlanId` guard), so a plan switch can never read the previous plan's days as empty and double-book.
- **R11. Insert mechanics: a dedicated `addUsuals()`.** ONE multi-row insert (one statement, so every row lands or none does), optimistic like `addMeal` (milestone 10): temp rows first, real ids swapped in by matching `plan_date` + `recipe_id` (no reliance on RETURNING order), rollback of only those temp rows when the write fails, and a `written` guard so a refresh failure after a good insert keeps the rows. Rows carry `meal_type: "dinner"` (vestigial NOT NULL, `use-plan.ts:451-454`), `slot_type: "cook"`, `serving_multiplier: 1`. Not N calls to `addMeal`: that is N statements (partial failure possible), N plan refreshes, N status messages, and each call closes the takeover.
- **R12. Grocery staleness.** `bump_plan_version` (`schema.sql:570-612`, insert branch 579-584) adds 1 to the plan version per inserted cook row; the milestone 10 Shop banner then offers "Update list". Add no regeneration calls.
- **R13. Weekday math.** New `weekdayOf(ymd)` in `lib/date-utils.ts`, built on the existing private `parseYmd` (local calendar fields, `date-utils.ts:14-17`). Never `new Date("YYYY-MM-DD")` (parsed as UTC, shifts a day west of UTC). Tested at DST, leap-day, and year boundaries; the new suites also run under UTC+14 and UTC-11.
- **R14. Freshness.** History loads once per page load and ends yesterday, so nothing written this session (today or later) can change a habit. Backfilling a past day mid-session shows up after a reload (accepted).

Database facts the insert must satisfy (all already true for the rows in R11): `meal_type` NOT NULL in ('lunch','dinner') (`schema.sql:108`); cook rows need `recipe_id` (`schema.sql:116-119`); non-leftover rows have no `leftover_from_item_id` (`schema.sql:121-124`); `serving_multiplier > 0` (`schema.sql:113`); `validate_meal_plan_item` locks the plan, requires `plan_date` inside the saved range and a recipe owned by the plan owner (`schema.sql:460-535`, checks at 477-495). There is no unique constraint on (plan, date): the client-side empty-day rule is the only guard against double-booking, hence R10.

---

## 3. Builder ground rules (non-negotiable)

1. Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`, one level BELOW the shell cwd. Start every Bash command with `cd /Users/mitchell/Dev/meal-queue/meal-queue &&`.
2. **Never**: commit, push, merge, install or upgrade dependencies, change `supabase/**`, or touch live (prod) Supabase data. Harnesses and captures run on the LOCAL stack only.
3. **Never write under `docs/`.** The orchestrator updates docs at wrap (§12). If a value is missing, STOP and report it.
4. **CSS:** color and font only through `var(--...)` tokens; no hex, no font names. There are no spacing tokens, so use only the values given in §8, each copied from an existing rule. No new magic numbers.
5. **Copy:** every user-visible string and every board string is exactly as written here. Add no em-dash anywhere (check in §9).
6. **Start from a clean tree on local `main`** (do not pull; the orchestrator syncs `main` before dispatch). If `git status` shows changes you did not make, STOP and report. Do not stash, discard, or carry them.
7. **Batch-Read before editing:** `lib/hooks/use-plan.ts` (whole file), `components/plan-add-meal.tsx`, `components/plan-day-items.tsx`, `app/plans/page.tsx`, `lib/date-utils.ts`, `lib/date-utils.test.ts`, `app/globals.css` lines 520-830, 1140-1250, 1415-1465, `supabase/schema.sql` lines 104-125, 247-260, 453-612, `scripts/review-board/README.md`, `verify-optimistic-pass.mjs`, `verify-shop-pass.mjs`, `capture-shop-variants.mjs`, `gen-board-sb1.mjs`, and `docs/design-system.md` (sections "Spacing & radius conventions" and "Plan components").
8. **Gate** before starting and before each hand-back: `npm run typecheck && npm run test && npm run lint`. At spec time vitest is 141 tests across 9 files.
9. RTK rewrites some shell commands and can condense output. Prefix `rtk proxy ` whenever exact output matters (diffs, test counts, harness logs).
10. **Imports in `lib/`:** tested `lib/` modules import runtime values with relative paths (`lib/import/normalize.ts:6-8`); there is no vitest config to resolve `@/`. So `lib/weekday-habits.ts` imports `./date-utils`, never `@/lib/date-utils`. Hooks and components keep using `@/`.

**STOP points:**
- **①** After Phase 3: hand back the board HTML path plus Phase 0-2 results, then wait for the WS1-WS4 verdicts (and F1/F2 if still open). Write no UI code before the verdicts.
- **②** After Phase 5: before ANY commit, hand back the change summary and every result. The builder never commits.
- **③** The orchestrator runs a senior `/code-review` (high) before merge. Apply fixes only when told.
- Also STOP if: the Phase 0 harness repair does not reach 16/16 and 22/22; a step seems to need a schema change, a dependency, or a value this spec does not give; the pinned browser clock causes hydration or auth errors; your vitest total is not 160.

---

## 4. Phase 0: branch, baseline, local stack, harness repair

1. From clean local `main`: `git switch -c codex/weekday-suggestions`.
2. Gate (§3 rule 8). Expect vitest 141/141 across 9 files.
3. Local stack: `supabase status`. If it is down: `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`. Dev server: `rm -rf .next`, then start in the background `NEXT_PUBLIC_SUPABASE_URL=<local API URL> NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key> npx next dev -p 3123`, both values from `supabase status`. Never use `.env.local` (it points at prod). Never run `next build` while this server is up (it poisons `.next` with prod URLs; see `scripts/review-board/README.md`).
4. **Harness repair** (pre-existing rot, unrelated to M17; nothing beyond these lines). Both plan-touching harnesses seed fixed July 2026 dates (`verify-shop-pass.mjs:47-59`, `verify-optimistic-pass.mjs:47-62`), but Shop only loads plans that end today or later (`lib/hooks/use-grocery-list.ts:77-84`). And `verify-shop-pass.mjs:159-163` waits on `.quick-add-card`, which nothing has rendered since the add-meal takeover shipped (PR #36, 2026-07-08; only a dead rule remains at `app/globals.css:545-552`).
   a. `scripts/review-board/verify-optimistic-pass.mjs`: directly after line 96 (`const page = await ctx.newPage();`) add:
      `  await page.clock.setFixedTime(new Date("2026-07-08T12:00:00")); // seeds are July-dated: pin "today" inside them`
   b. `scripts/review-board/verify-shop-pass.mjs`: FIRST, on lines 159, 160, 161, and 163 replace `.quick-add-card` with `.plan-add-meal` (4 occurrences; nothing else on those lines changes). THEN add the same clock line directly after line 84 (`const page = await ctx.newPage();`). In this order the cited line numbers stay valid.
   c. Run both against the UNMODIFIED app: `node scripts/review-board/verify-optimistic-pass.mjs` must end `16/16 passed, 0 console errors`; `node scripts/review-board/verify-shop-pass.mjs` must end `22/22 passed, 0 console errors`. If either differs, STOP with the full log.

   Note: Playwright 1.63 (the house npx path) has `page.clock.setFixedTime`, which fakes `Date` while timers keep running. Pin only to past dates: a clock later than real time makes supabase-js treat the session as expired.

---

## 5. Phase 1: pure logic (`lib/date-utils.ts` + new `lib/weekday-habits.ts`, fully vitest-covered)

**Step 1. `lib/date-utils.ts`:** add directly after `nextDayInRange` (lines 88-91):

```ts
// 0 = Sunday ... 6 = Saturday (Date#getDay order, the same order as the
// user_settings weekday columns). Built from local calendar fields like the
// helpers above, so a YYYY-MM-DD never shifts across timezones (milestone 17).
export function weekdayOf(ymd: string) {
  return parseYmd(ymd).getDay();
}
```

**Step 2. `lib/date-utils.test.ts`:** add `weekdayOf` to the import list (lines 2-16) and this test at the end of the first `describe` (after line 77):

```ts
  it("derives the weekday from calendar fields across DST, leap-day, and year boundaries", () => {
    expect(weekdayOf("2026-07-02")).toBe(4);
    expect(weekdayOf("2026-03-08")).toBe(0);
    expect(weekdayOf("2026-11-01")).toBe(0);
    expect(weekdayOf("2024-02-29")).toBe(4);
    expect(weekdayOf("2025-12-31")).toBe(3);
    expect(weekdayOf("2026-01-01")).toBe(4);
  });
```

**Step 3. `lib/weekday-habits.ts` (new).** Use this reference implementation verbatim; change it only if lint or typecheck require, and report any change.

```ts
import { addDays, dateRange, weekdayOf } from "./date-utils";

// Weekday habits (milestone 17; habit rule locked by the owner 2026-10-02).
// A recipe is a habit on a weekday when it was cooked on at least
// HABIT_MIN_COOKS of that weekday's last HABIT_OCCURRENCES occurrences.
//
// - Cooked: a slot_type 'cook' item on a date before today. The app has no
//   cooked state (design flag C2), so plan history is the record.
// - Occurrence: a date of that weekday inside the lookback window with at
//   least one meal_plan_items row of ANY slot type. A week with nothing planned
//   is unknown, so it never counts; an eat-out or leftovers-only day counts as
//   a miss.
// - Window: the HABIT_LOOKBACK_DAYS before today. Today is excluded, so
//   nothing planned today or later changes a habit.
// Pure functions: no Supabase, no React.

export const HABIT_LOOKBACK_DAYS = 112; // 16 weeks: 8 occurrences survive 8 unplanned weeks
export const HABIT_OCCURRENCES = 8;
export const HABIT_MIN_COOKS = 3;
export const SUGGESTION_LIMIT = 3;

export type HabitHistoryRow = {
  plan_date: string; // YYYY-MM-DD
  slot_type: "cook" | "leftover" | "eat_out";
  recipe_id: string | null;
};

export type HabitRecipe = { id: string; name: string };

export type WeekdayHabit<T extends HabitRecipe> = {
  recipe: T;
  cookedOn: number; // considered occurrences with this recipe cooked
  occurrences: number; // occurrences considered (at most HABIT_OCCURRENCES)
  lastCooked: string; // latest considered occurrence it was cooked on
};

export type PlannedUsual<T extends HabitRecipe> = { plan_date: string; recipe: T };

export function habitWindowStart(todayYmd: string) {
  return addDays(todayYmd, -HABIT_LOOKBACK_DAYS);
}

export function weekdayHabits<T extends HabitRecipe>(
  history: HabitHistoryRow[],
  weekday: number,
  todayYmd: string,
  recipes: T[],
): WeekdayHabit<T>[] {
  const windowStart = habitWindowStart(todayYmd);
  const rows = history.filter(
    (row) => row.plan_date >= windowStart && row.plan_date < todayYmd && weekdayOf(row.plan_date) === weekday,
  );
  const occurrences = new Set(
    [...new Set(rows.map((row) => row.plan_date))].sort((a, b) => b.localeCompare(a)).slice(0, HABIT_OCCURRENCES),
  );
  const cookDates = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.slot_type !== "cook" || !row.recipe_id || !occurrences.has(row.plan_date)) continue;
    const dates = cookDates.get(row.recipe_id) ?? new Set<string>();
    dates.add(row.plan_date);
    cookDates.set(row.recipe_id, dates);
  }
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const habits: WeekdayHabit<T>[] = [];
  for (const [recipeId, dates] of cookDates) {
    const recipe = recipeById.get(recipeId);
    if (!recipe || dates.size < HABIT_MIN_COOKS) continue; // unknown id = deleted recipe
    habits.push({
      recipe,
      cookedOn: dates.size,
      occurrences: occurrences.size,
      lastCooked: [...dates].reduce((latest, date) => (date > latest ? date : latest)),
    });
  }
  // Strongest first; on a tie the one cooked longest ago first (an alternating
  // pair puts the one not cooked last time on top); then by name.
  return habits.sort(
    (a, b) =>
      b.cookedOn - a.cookedOn ||
      a.lastCooked.localeCompare(b.lastCooked) ||
      a.recipe.name.localeCompare(b.recipe.name),
  );
}

// The takeover group: top habits for that day's weekday, minus recipes already
// planned that day, capped at SUGGESTION_LIMIT (the cap applies after the cut).
export function suggestionsForDay<T extends HabitRecipe>(
  history: HabitHistoryRow[],
  day: string,
  todayYmd: string,
  recipes: T[],
  plannedRecipeIds: ReadonlySet<string> = new Set<string>(),
): T[] {
  return weekdayHabits(history, weekdayOf(day), todayYmd, recipes)
    .filter((habit) => !plannedRecipeIds.has(habit.recipe.id))
    .slice(0, SUGGESTION_LIMIT)
    .map((habit) => habit.recipe);
}

// "Add the usuals": what to place on a plan. Days on or after today with no
// item at all, each given its weekday's top habit; date order.
export function planUsuals<T extends HabitRecipe>({
  planStart,
  planEnd,
  todayYmd,
  occupiedDates,
  history,
  recipes,
}: {
  planStart: string;
  planEnd: string;
  todayYmd: string;
  occupiedDates: ReadonlySet<string>;
  history: HabitHistoryRow[];
  recipes: T[];
}): PlannedUsual<T>[] {
  const habitsByWeekday = new Map<number, WeekdayHabit<T>[]>();
  const planned: PlannedUsual<T>[] = [];
  for (const day of dateRange(planStart, planEnd)) {
    // Never backfill the past; never add to a day that already has anything.
    if (day < todayYmd || occupiedDates.has(day)) continue;
    const weekday = weekdayOf(day);
    let habits = habitsByWeekday.get(weekday);
    if (!habits) {
      habits = weekdayHabits(history, weekday, todayYmd, recipes);
      habitsByWeekday.set(weekday, habits);
    }
    // F1 (a): one meal per empty day, the top-ranked habit.
    if (habits[0]) planned.push({ plan_date: day, recipe: habits[0].recipe });
  }
  return planned;
}
```

**Step 4. `lib/weekday-habits.test.ts` (new): exactly the 18 tests below.** Every expectation was checked against a prototype of this implementation. File header:

```ts
import { describe, expect, it } from "vitest";
import { habitWindowStart, planUsuals, suggestionsForDay, weekdayHabits } from "./weekday-habits";
import type { HabitHistoryRow } from "./weekday-habits";

const TODAY = "2026-09-30"; // a Wednesday; habit window 2026-06-10 .. 2026-09-29
const RECIPES = [
  { id: "chicken", name: "Crispy Chicken Thighs" },
  { id: "salmon", name: "Sheet-Pan Salmon" },
  { id: "cod", name: "Baked Cod" },
  { id: "beans", name: "Hurst 15-Bean Soup" },
  { id: "tacos", name: "Weeknight Tacos" },
  { id: "pasta", name: "Caprese Pasta" },
  { id: "soup", name: "Chicken Noodle Soup" },
  { id: "stew", name: "Beef Stew" },
  { id: "rice", name: "Coconut Rice" },
  { id: "greens", name: "Garlic Greens" },
  { id: "pizza", name: "Pizza Night" },
];
const recipe = (id: string) => RECIPES.find((item) => item.id === id)!;
const cook = (plan_date: string, recipe_id: string): HabitHistoryRow => ({ plan_date, slot_type: "cook", recipe_id });
const eatOut = (plan_date: string): HabitHistoryRow => ({ plan_date, slot_type: "eat_out", recipe_id: null });
const leftover = (plan_date: string, recipe_id: string): HabitHistoryRow => ({ plan_date, slot_type: "leftover", recipe_id });
const names = (list: Array<{ name: string }>) => list.map((item) => item.name);

// The last 8 Thursdays and Sundays before TODAY.
const THU8 = ["2026-09-24", "2026-09-17", "2026-09-10", "2026-09-03", "2026-08-27", "2026-08-20", "2026-08-13", "2026-08-06"];
const SUN8 = ["2026-09-27", "2026-09-20", "2026-09-13", "2026-09-06", "2026-08-30", "2026-08-23", "2026-08-16", "2026-08-09"];

// Fridays: pizza 5, cod 4 (last 09-25), salmon 4 (last 09-18), rice and greens 3 each on the same dates.
const RANKED_FRIDAYS: HabitHistoryRow[] = [
  ...["2026-09-25", "2026-09-11", "2026-08-28", "2026-08-14"].map((d) => cook(d, "cod")),
  ...["2026-09-18", "2026-09-04", "2026-08-21", "2026-08-07"].map((d) => cook(d, "salmon")),
  ...["2026-09-25", "2026-09-18", "2026-09-11", "2026-09-04", "2026-08-28"].map((d) => cook(d, "pizza")),
  ...["2026-09-18", "2026-09-11", "2026-09-04"].map((d) => cook(d, "greens")),
  ...["2026-09-18", "2026-09-11", "2026-09-04"].map((d) => cook(d, "rice")),
];

// A household week: Thu chicken 8/8; Fri cod and salmon alternate 4/4; Sun beans
// 3/8 with eat-outs on the other 5 Sundays; Tue tacos on the only 3 planned Tuesdays.
const WEEK: HabitHistoryRow[] = [
  ...THU8.map((d) => cook(d, "chicken")),
  ...["2026-09-25", "2026-09-11", "2026-08-28", "2026-08-14"].map((d) => cook(d, "cod")),
  ...["2026-09-18", "2026-09-04", "2026-08-21", "2026-08-07"].map((d) => cook(d, "salmon")),
  ...["2026-09-27", "2026-09-13", "2026-08-30"].map((d) => cook(d, "beans")),
  ...["2026-09-20", "2026-09-06", "2026-08-23", "2026-08-16", "2026-08-09"].map(eatOut),
  ...["2026-07-21", "2026-07-14", "2026-07-07"].map((d) => cook(d, "tacos")),
];
```

Tests (weekday numbers: 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat). "H(r, c, o, last)" means `{ recipe: recipe(r), cookedOn: c, occurrences: o, lastCooked: last }`; use `toEqual`.

| # | describe / it | History and call | Expected |
|---|---|---|---|
| 1 | habitWindowStart / "starts the window 112 days (16 weeks) before today" | `habitWindowStart(TODAY)` | `"2026-06-10"` |
| 2 | weekdayHabits / "finds a recipe cooked on all of the last 8 Thursdays" | THU8 all `cook(d, "chicken")`; weekday 4 | `[H("chicken", 8, 8, "2026-09-24")]` |
| 3 | weekdayHabits / "needs at least 3 cooks among the last 8 occurrences" | chicken on 09-24, 09-10, 08-27; salmon on 09-17, 09-03; eatOut on 08-20, 08-13, 08-06; weekday 4 | `[H("chicken", 3, 8, "2026-09-24")]` (salmon at 2 is left out) |
| 4 | weekdayHabits / "counts only dates with a planned meal, so unplanned weeks do not dilute a habit" | tacos on 2026-07-21, 07-14, 07-07 and nothing else; weekday 2 | `[H("tacos", 3, 3, "2026-07-21")]` |
| 5 | weekdayHabits / "looks at the 8 most recent occurrences only" | eatOut on all SUN8; pasta on 2026-08-02, 07-26, 07-19; weekday 0 | `[]` |
| 6 | weekdayHabits / "counts eat-out and leftover days as occurrences but never counts leftovers as cooks" | beans on 09-27, 09-13, 08-30; `leftover(d, "soup")` on 09-20, 09-06, 08-23; weekday 0 | `[H("beans", 3, 6, "2026-09-27")]` |
| 7 | weekdayHabits / "includes the window's first day and ignores anything earlier" | (a) stew on 2026-06-10, 06-17, 06-24; (b) stew on 2026-06-03, 06-17, 06-24; weekday 3 | (a) `[H("stew", 3, 3, "2026-06-24")]`; (b) `[]` |
| 8 | weekdayHabits / "ignores today and future dates" | stew on 2026-09-30, 10-07, 10-14; weekday 3 | `[]` |
| 9 | weekdayHabits / "counts a recipe once per date even when it is planned twice that day" | (a) chicken twice on 09-24 plus 09-17; (b) the same plus 09-10; weekday 4 | (a) `[]`; (b) `[H("chicken", 3, 3, "2026-09-24")]` |
| 10 | weekdayHabits / "ranks by cook count, then the habit cooked longest ago, then name" | RANKED_FRIDAYS; weekday 5; compare `names(result.map((h) => h.recipe))` | `["Pizza Night", "Sheet-Pan Salmon", "Baked Cod", "Coconut Rice", "Garlic Greens"]` |
| 11 | weekdayHabits / "keeps weekdays separate" | THU8 chicken; weekday 3, then weekday 5 | `[]` both |
| 12 | weekdayHabits / "drops recipes that are no longer in the recipe list" | THU8 all `cook(d, "deleted")`; weekday 4 | `[]` |
| 13 | suggestionsForDay / "returns at most 3 recipes for the day's weekday, in rank order" | RANKED_FRIDAYS; day `"2026-10-02"` (a Friday) | names `["Pizza Night", "Sheet-Pan Salmon", "Baked Cod"]` |
| 14 | suggestionsForDay / "leaves out recipes already planned that day, before applying the cap" | RANKED_FRIDAYS; day `"2026-10-02"`; `plannedRecipeIds = new Set(["pizza"])` | names `["Sheet-Pan Salmon", "Baked Cod", "Coconut Rice"]` |
| 15 | suggestionsForDay / "returns nothing for a weekday without habits" | THU8 chicken; day `"2026-10-05"` (a Monday) | `[]` |
| 16 | planUsuals / "puts the top habit on each empty day of the plan" | WEEK; plan 2026-10-01 to 10-07; occupied `{"2026-10-04"}` | `[{2026-10-01, chicken}, {2026-10-02, salmon}, {2026-10-06, tacos}]` as `{ plan_date, recipe: recipe(id) }` objects |
| 17 | planUsuals / "skips occupied days and days before today" | WEEK; plan 2026-09-28 to 10-04; occupied `{"2026-10-02", "2026-10-04"}` | `[{2026-10-01, chicken}]` (Tue 09-29 would get tacos if past days were not skipped) |
| 18 | planUsuals / "fills every matching weekday in a plan longer than a week" | WEEK; plan 2026-10-01 to 10-14; occupied empty set | 8 rows: 10-01 chicken, 10-02 salmon, 10-04 beans, 10-06 tacos, 10-08 chicken, 10-09 salmon, 10-11 beans, 10-13 tacos |

All dates in the table are 2026 unless written in full. Gate after Phase 1: **160 tests across 10 files** (141 + 1 date-utils + 18).

---

## 6. Phase 2: hook wiring (`lib/hooks/use-plan.ts`; no visible UI change yet)

Edit only the places below. Everything else in the file stays byte-identical (see §11). Line numbers are those of `main` BEFORE any edit, and each insertion shifts the lines below it: apply the steps bottom-up (step 10 first, step 1 last), or locate each anchor by the quoted code rather than by number.

1. **Imports:** after line 11 (`import { supabase } ...`) add:
   ```ts
   import { habitWindowStart, planUsuals, suggestionsForDay } from "@/lib/weekday-habits";
   import type { HabitHistoryRow, PlannedUsual } from "@/lib/weekday-habits";
   ```
2. **State:** after line 89 (`recentRecipeIds`) add:
   ```ts
   // Milestone 17: weekday-habit history (the 16 weeks before today) and the plan
   // `items` currently belongs to (guards "Add the usuals" across plan switches).
   const [habitRows, setHabitRows] = useState<HabitHistoryRow[]>([]);
   const [itemsPlanId, setItemsPlanId] = useState<string | null>(null);
   ```
3. **`quickSuggestions`:** insert after line 128 (`const itemById = ...`), BEFORE the `quickMatches` comment at line 130 (`quickMatches` reads it):
   ```ts
   // Milestone 17: "Usually on <Weekday>s" for the add-meal takeover. Cook mode
   // with an empty search box only; recipes already planned that day are left out.
   const quickSuggestions = useMemo(() => {
     if (!activeDay || quickMode !== "cook" || quickQuery.trim()) return [] as RecipeOption[];
     const plannedThatDay = new Set(
       items.filter((item) => item.plan_date === activeDay && item.recipe).map((item) => item.recipe!.id),
     );
     return suggestionsForDay(habitRows, activeDay, todayYmd, recipes, plannedThatDay);
   }, [activeDay, quickMode, quickQuery, items, habitRows, todayYmd, recipes]);
   ```
4. **`quickMatches`:** replace lines 130-140 with:
   ```ts
   // Most-recently-planned recipes surface first (owner request, 2026-07-02
   // review) so the household rotation is one tap away; ties fall back to name.
   // Milestone 17: with an empty query, recipes already shown in the "Usually on
   // <Weekday>s" group are left out so nothing appears twice.
   const quickMatches = useMemo(() => {
     const query = quickQuery.trim().toLowerCase();
     const rank = (recipe: RecipeOption) => {
       const index = recentRecipeIds.indexOf(recipe.id);
       return index === -1 ? recentRecipeIds.length : index;
     };
     const suggestedIds = new Set(quickSuggestions.map((recipe) => recipe.id));
     const pool = query
       ? recipes.filter((recipe) => recipe.name.toLowerCase().includes(query))
       : recipes.filter((recipe) => !suggestedIds.has(recipe.id));
     return [...pool].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 8);
   }, [recipes, quickQuery, recentRecipeIds, quickSuggestions]);
   ```
5. **`plannedUsuals`:** insert after `quickLeftoverOptions` (after line 153):
   ```ts
   // Milestone 17: what "Add the usuals" would place on the selected plan. Empty
   // until this plan's own items have loaded, so a plan switch can never read the
   // previous plan's days as empty.
   const plannedUsuals = useMemo(() => {
     if (!selectedPlan || itemsPlanId !== selectedPlan.id) return [] as PlannedUsual<RecipeOption>[];
     return planUsuals({
       planStart: selectedPlan.start_date,
       planEnd: selectedPlan.end_date,
       todayYmd,
       occupiedDates: new Set(items.map((item) => item.plan_date)),
       history: habitRows,
       recipes,
     });
   }, [selectedPlan, itemsPlanId, items, habitRows, recipes, todayYmd]);
   ```
6. **`loadInitialData`:** on line 206 change the destructure to `const [plansRes, recipesRes, settingsRes, recentRes, habitRes] = await Promise.all([`. Append a fifth entry after the recency query (after line 222, before `]);`):
   ```ts
        // Milestone 17: weekday-habit history, a bounded plan_date window (the
        // 16 weeks before today, today excluded). Kept separate from the recency
        // query above so that query stays exactly as it was.
        supabase
          .from("meal_plan_items")
          .select("plan_date, slot_type, recipe_id")
          .gte("plan_date", habitWindowStart(todayYmd))
          .lt("plan_date", todayYmd)
          .order("plan_date", { ascending: false })
          .limit(1000),
   ```
   Do NOT add `habitRes.error` to the failure check at line 225. After line 268 (the end of `setRecentRecipeIds(...)`) add:
   ```ts
    // Weekday habits feed suggestions and "Add the usuals" only; like recency,
    // an error here degrades to no suggestions rather than failing the page.
    setHabitRows(habitRes.error ? [] : ((habitRes.data ?? []) as HabitHistoryRow[]));
   ```
7. **`loadPlanItems`:** directly after the `setItems(...)` call (it ends at line 306), add `setItemsPlanId(planId);`. Leave the error path (lines 281-284) as it is.
8. **`addUsuals`:** add after `addMeal` (after line 495):
   ```ts
   // Milestone 17: "Add the usuals". ONE bulk insert (a single statement, so all
   // rows land or none do), optimistic like addMeal: temp rows first, real ids
   // swapped in on success, only these rows removed on a write failure. The
   // bump_plan_version trigger adds one version per cook row; the Shop banner
   // offers the list update. No regeneration here.
   async function addUsuals() {
     if (!selectedPlan || plannedUsuals.length === 0) return;
     const planId = selectedPlan.id;
     const batch = plannedUsuals;
     setSaving(true);
     setError(null);
     setMessage(null);

     const stamp = Date.now();
     const temps = batch.map((usual, index) => ({
       tempId: `optimistic-${stamp}-${index}-${Math.random().toString(36).slice(2, 10)}`,
       usual,
     }));
     const tempIds = new Set(temps.map((temp) => temp.tempId));
     let written = false;
     setItems((current) => [
       ...current,
       ...temps.map(({ tempId, usual }) => ({
         id: tempId,
         plan_date: usual.plan_date,
         slot_type: "cook" as const,
         leftover_from_item_id: null,
         note: null,
         serving_multiplier: 1,
         created_at: new Date().toISOString(),
         recipe: usual.recipe,
       })),
     ]);

     try {
       const { data: inserted, error: insertError } = await supabase
         .from("meal_plan_items")
         .insert(
           batch.map((usual) => ({
             meal_plan_id: planId,
             plan_date: usual.plan_date,
             // Vestigial NOT NULL column: every new row writes 'dinner' (see addMeal).
             meal_type: "dinner",
             slot_type: "cook",
             recipe_id: usual.recipe.id,
             serving_multiplier: 1,
           })),
         )
         .select("id, plan_date, recipe_id");
       if (insertError) throw insertError;
       written = true;

       // Match returned rows to temp rows by date + recipe (unique in the batch),
       // so nothing depends on RETURNING order.
       const realIdByKey = new Map(
         ((inserted ?? []) as Array<{ id: string; plan_date: string; recipe_id: string }>).map((row) => [
           `${row.plan_date}|${row.recipe_id}`,
           row.id,
         ]),
       );
       const realIdByTemp = new Map(
         temps.map(({ tempId, usual }) => [tempId, realIdByKey.get(`${usual.plan_date}|${usual.recipe.id}`)]),
       );
       setItems((current) =>
         current.map((value) => {
           const realId = realIdByTemp.get(value.id);
           return realId ? { ...value, id: realId } : value;
         }),
       );
       // Defensive: if any row went unmatched, reload this plan's items so no
       // temp id survives into a later remove or serving write.
       if ([...realIdByTemp.values()].some((realId) => !realId)) {
         await loadPlanItems(planId);
       }
       await refreshPlansAndKeepSelection(planId);
       setMessage(batch.length === 1 ? "Added 1 usual meal." : `Added ${batch.length} usual meals.`);
     } catch (caughtError) {
       if (!written) setItems((current) => current.filter((value) => !tempIds.has(value.id)));
       setError(toErrorMessage(caughtError, "Failed adding the usuals."));
     } finally {
       setSaving(false);
     }
   }
   ```
   (A refresh failure after a good insert shows the error while the rows stay; that mirrors `addMeal` and is accepted.)
9. **Keyboard:** in `handleQuickAddKeyDown`, line 616 becomes `const top = quickSuggestions[0] ?? quickMatches[0];`. Nothing else in that function changes.
10. **Return object** (lines 640-680): add `quickSuggestions` after `quickMatches` (line 666), and `plannedUsuals` and `addUsuals` after `addMeal` (line 675). Remove or rename nothing.

Gate after Phase 2: typecheck, lint, vitest 160. (On this branch, between Phase 2 and Phase 4, a habit recipe is left out of the regular list before the group renders. Expected; never shipped.)

---

## 7. Phase 3: seed, variant mocks, board, then STOP ①

All scripts follow the house pattern in `verify-optimistic-pass.mjs` (playwright-core from the house npx path, `BASE = http://localhost:3123`, libpq `psql`, `LOCAL_DB = postgresql://postgres:postgres@127.0.0.1:54322/postgres`, a 390x844 iPhone context, `ctx.route(/supabase\.co/, abort)`, sign-in with sign-up fallback, teardown in `finally`). Two differences:

- **Dedicated user `wsverify@local.test`**, not the reviewer account: habits read ALL of a user's plans, so the reviewer's seeds (for example `seed-review.sql` puts chicken on Thu 2026-07-02, inside the window) would skew exact counts. Use the same local-only password literal the other harnesses use (`verify-optimistic-pass.mjs:112`).
- **Pinned clock:** directly after `const page = await ctx.newPage();` add `await page.clock.setFixedTime(new Date("2026-09-30T12:00:00"));` (a Wednesday). All seeded dates assume it.

**3.1 Seed file `scripts/review-board/seed-weekday-suggestions.sql` (new, tracked).** Run it with `execSync(\`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${SEED}"\`, { stdio: "inherit" })` after sign-in. Content, verbatim:

```sql
-- Milestone 17 (weekday suggestions) board and harness seed. LOCAL stack only,
-- never prod. Owner: wsverify@local.test (the scripts sign it up on first run).
-- Idempotent: wipes that user's plans and recipes first. Dates assume the
-- scripts pin the browser clock to Wed 2026-09-30, so the habit window is
-- 2026-06-10 .. 2026-09-29. Columns confirmed against supabase/schema.sql.
do $$
declare
  v_user uuid;
  r_chicken uuid; r_salmon uuid; r_cod uuid; r_beans uuid; r_tacos uuid;
  r_pasta uuid; r_soup uuid; r_stew uuid; r_stirfry uuid;
  v_hist uuid; v_t1 uuid; v_t2 uuid;
begin
  select id into v_user from auth.users where email = 'wsverify@local.test';
  if v_user is null then
    raise exception 'wsverify@local.test missing (run the sign-in phase first)';
  end if;
  delete from public.meal_plans where user_id = v_user;
  delete from public.recipes where user_id = v_user;

  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Crispy Chicken Thighs', 4) returning id into r_chicken;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Sheet-Pan Salmon', 2) returning id into r_salmon;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Baked Cod', 2) returning id into r_cod;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Hurst 15-Bean Soup', 6) returning id into r_beans;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Weeknight Tacos', 4) returning id into r_tacos;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Caprese Pasta', 2) returning id into r_pasta;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Chicken Noodle Soup', 4) returning id into r_soup;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Beef Stew', 6) returning id into r_stew;
  insert into public.recipes (user_id, name, base_servings) values (v_user, 'Veggie Stir-Fry', 2) returning id into r_stirfry;
  insert into public.recipes (user_id, name, base_servings) values
    (v_user, 'Greek Salad', 2), (v_user, 'Lentil Curry', 4), (v_user, 'Mushroom Risotto', 4);

  insert into public.ingredients (recipe_id, name, amount, unit_code, is_pantry_staple) values
    (r_stirfry, 'ws bell pepper', 2, 'item', false),
    (r_stirfry, 'ws snap peas', 8, 'oz', false),
    (r_chicken, 'ws chicken thighs', 2, 'lb', false),
    (r_salmon, 'ws salmon fillet', 1, 'lb', false),
    (r_beans, 'ws bean soup mix', 20, 'oz', false),
    (r_tacos, 'ws tortillas', 8, 'item', false);

  -- History: one long past plan ending the day before the pinned today.
  insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, date '2026-05-15', date '2026-09-29') returning id into v_hist;

  -- Thu: chicken on all of the last 8 Thursdays (habit, 8 of 8).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_chicken
  from unnest(array['2026-09-24','2026-09-17','2026-09-10','2026-09-03','2026-08-27','2026-08-20','2026-08-13','2026-08-06']::date[]) as t(d);

  -- Fri: cod and salmon alternate, 4 each (both habits; salmon ranks first because cod was cooked last).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_cod
  from unnest(array['2026-09-25','2026-09-11','2026-08-28','2026-08-14']::date[]) as t(d);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_salmon
  from unnest(array['2026-09-18','2026-09-04','2026-08-21','2026-08-07']::date[]) as t(d);

  -- Sun: beans on 3 of the last 8 (habit at the bar); eat-out on the other 5;
  -- pasta 3 times, but only on older Sundays outside the last 8 (not a habit).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_beans
  from unnest(array['2026-09-27','2026-09-13','2026-08-30']::date[]) as t(d);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, note)
  select v_hist, t.d, 'dinner', 'eat_out', 'Out with friends'
  from unnest(array['2026-09-20','2026-09-06','2026-08-23','2026-08-16','2026-08-09']::date[]) as t(d);
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_pasta
  from unnest(array['2026-08-02','2026-07-26','2026-07-19']::date[]) as t(d);

  -- Mon: soup on the only 2 planned Mondays (2 of 2, below the bar of 3).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_soup
  from unnest(array['2026-09-28','2026-09-21']::date[]) as t(d);

  -- Tue: tacos on the only 3 planned Tuesdays, 10-12 weeks back (3 of 3: unplanned weeks do not dilute).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_tacos
  from unnest(array['2026-07-21','2026-07-14','2026-07-07']::date[]) as t(d);

  -- Wed: stew 3 times, all before the 2026-06-10 window start (not a habit).
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select v_hist, t.d, 'dinner', 'cook', r_stew
  from unnest(array['2026-06-03','2026-05-27','2026-05-20']::date[]) as t(d);

  -- T1: Thu 2026-10-01 .. Wed 2026-10-07; Sunday already taken by an eat-out.
  insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, date '2026-10-01', date '2026-10-07') returning id into v_t1;
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, note)
    values (v_t1, date '2026-10-04', 'dinner', 'eat_out', 'Dinner with friends');

  -- T2: Thu 2026-10-08 .. Wed 2026-10-14; Monday has a stir-fry (gives Shop a list).
  insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, date '2026-10-08', date '2026-10-14') returning id into v_t2;
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
    values (v_t2, date '2026-10-12', 'dinner', 'cook', r_stirfry);
end $$;
```

Plan ids for the scripts: `select id from public.meal_plans where user_id=(select id from auth.users where email='wsverify@local.test') and start_date=date '<start>'` with starts `2026-05-15` (HIST), `2026-10-01` (T1), `2026-10-08` (T2). Teardown SQL (both scripts, in `finally`):

```sql
delete from public.meal_plans where user_id=(select id from auth.users where email='wsverify@local.test');
delete from public.recipes where user_id=(select id from auth.users where email='wsverify@local.test');
```

What this seed yields (pinned today 2026-09-30, verified in a prototype): Thu chicken 8/8; Fri salmon then cod, 4/8 each; Sun beans 3/8 (pasta excluded); Tue tacos 3/3; Mon and Wed nothing. Add the usuals on T1 places Thu 10-01 chicken, Fri 10-02 salmon, Tue 10-06 tacos (Sunday is occupied); on T2 it places Thu 10-08 chicken, Fri 10-09 salmon, Sun 10-11 beans, Tue 10-13 tacos; on HIST nothing (all past).

**3.2 `scripts/review-board/capture-ws-variants.mjs` (new).** Writes JPEGs to `scripts/review-board/shots-ws/` (gitignored). After every `page.goto`, inject the §8 base CSS (both the takeover block and the card block) with `page.addStyleTag`, because those classes are not in `globals.css` yet; also hide `nextjs-portal` as the house scripts do. Keep the returned handle of any variant style tag and remove it (`await handle.evaluate((el) => el.remove())`) before the next shot.

- **WS1 (group look):** `goto /plans?plan=<T1>`; click the (+) labeled `Add a meal on Oct 1`; inject the mock group directly after the search input and remove same-named rows from `.quick-add-results`:
  ```js
  await page.evaluate(({ label, rows }) => {
    const input = document.querySelector('.plan-add-meal input[placeholder="Search recipe..."]');
    const group = document.createElement("div");
    group.className = "quick-add-usuals";
    group.setAttribute("role", "group");
    group.innerHTML = `<p class="quick-add-usuals-label">${label}</p>` + rows
      .map(([name, serves]) => `<button class="quick-add-row" type="button"><span>${name}</span><span class="muted">Serves ${serves}</span></button>`)
      .join("");
    input.insertAdjacentElement("afterend", group);
    for (const row of document.querySelectorAll(".quick-add-results .quick-add-row")) {
      if (rows.some(([name]) => row.querySelector("span")?.textContent === name)) row.remove();
    }
  }, { label: "Usually on Thursdays", rows: [["Crispy Chicken Thighs", 4]] });
  ```
  Shoot the viewport as `WS1-A-thu.jpg`; add the WS1-B CSS (§8), shoot `WS1-B-thu.jpg`, remove it. Close (`.plan-add-close`), open `Add a meal on Oct 2`, inject label `Usually on Fridays` with rows `Sheet-Pan Salmon` (2) and `Baked Cod` (2), shoot `WS1-A-fri.jpg` and `WS1-B-fri.jpg`.
- **WS2 and WS3 (card placement and look):** fresh `goto /plans?plan=<T1>`; inject the card before the first `.plan-dayrow`:
  ```js
  await page.evaluate(({ line, list }) => {
    const card = document.createElement("div");
    card.className = "plan-usuals";
    card.innerHTML = `<div class="plan-usuals-text"><p class="plan-usuals-line">${line}</p><p class="plan-usuals-list">${list}</p></div><button class="plan-usuals-btn" type="button">Add the usuals</button>`;
    document.querySelector(".plan-dayrow").insertAdjacentElement("beforebegin", card);
  }, { line: "3 empty days have a usual meal.", list: "Thu: Crispy Chicken Thighs, Fri: Sheet-Pan Salmon, Tue: Weeknight Tacos" });
  ```
  Shots: `WS2-A.jpg` (viewport, top of page; also serves as WS3-A) and `WS3-A-card.jpg` (element shot of `.plan-usuals`). Then `WS2-B.jpg`: remove the card and insert `<button class="ghost-btn" type="button">Add the usuals</button>` into `.plan-head-meta` before its first `.ghost-btn` (the Edit button). Then `WS2-C.jpg`: remove that button, re-insert the card directly before `.plan-generate`, scroll to the bottom, viewport shot. Then put the card back above the first day row and inject this WS3-B mock override (it sits on top of the injected A rules, so it must reset the card skin explicitly), shoot `WS3-B.jpg` and `WS3-B-card.jpg`:
  ```css
  .plan-usuals { display: grid; gap: 0.45rem; padding: 0; background: none; border: 0; }
  .plan-usuals-btn { width: 100%; padding: 0.9rem; font-size: 1rem; background: var(--brand); color: var(--surface); }
  ```
  (The WS1-B shots need no reset: inject the §8 WS1 B block as written; being injected later, it wins over the A block.)
- **WS4 (feedback):** insert the three real rows with one `psqlQuery` call (single quotes only, no `$$`), substituting the T1 id:
  ```sql
  insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id)
  select '<T1>', v.d::date, 'dinner', 'cook', r.id
  from (values ('2026-10-01', 'Crispy Chicken Thighs'), ('2026-10-02', 'Sheet-Pan Salmon'), ('2026-10-06', 'Weeknight Tacos')) as v(d, name)
  join public.recipes r on r.name = v.name and r.user_id = (select id from auth.users where email = 'wsverify@local.test');
  ```
  Then reload `/plans?plan=<T1>`. A: insert `<p class="success-text" role="status">Added 3 usual meals.</p>` directly after `.plan-picker-row` (fall back to after `.plan-filter-row` if there is no picker), shoot `WS4-A.jpg`. B: remove it and insert `<div class="plan-usuals"><p class="plan-usuals-line success-text">Added 3 usual meals.</p></div>` before the first `.plan-dayrow`, shoot `WS4-B.jpg`.
- At the end, log ok/MISSING for the 12 files: `WS1-A-thu`, `WS1-B-thu`, `WS1-A-fri`, `WS1-B-fri`, `WS2-A`, `WS2-B`, `WS2-C`, `WS3-A-card`, `WS3-B`, `WS3-B-card`, `WS4-A`, `WS4-B` (all `.jpg`; WS3 A's in-context shot is `WS2-A`). Teardown in `finally`.

**3.3 `scripts/review-board/gen-board-ws.mjs` (new).** Clone `gen-board-sb1.mjs` (same self-contained page style and pin language); read `shots-ws/`; write `scripts/review-board/review-board-m17.html` (gitignored). Title `Meal Queue: Milestone 17 review`. No em-dashes anywhere in the board. WS2 uses a three-column variant grid that collapses to one column under 600px, like SB1's two-column grid. Copy, verbatim:

- Eyebrow `Meal Queue · Review board`. H1 `Milestone 17: weekday suggestions`. Lede: `Adding a meal now suggests what you usually cook on that weekday, and the Plan page gets a one-tap Add the usuals. Four style calls before any of these screens are coded. The shots are mocks on the real app with a seeded test history: chicken every Thursday, beans most Sundays, and two fish taking turns on Fridays.` Tags: `Round WS`, the capture date, `Mocks, no UI code yet`.
- **WS1** `How should the usuals look in the add screen?` Context: `Shown for Thursday (one usual) and Friday (two that take turns). The usuals sit between the search box and the regular list, and the list below drops them so nothing shows twice. Typing in the search box hides the group.` Variants: `A: Labeled list` (recommended) `Same rows as the search results, under a small day-style label.` (shots WS1-A-thu, WS1-A-fri); `B: Soft teal panel` `The same rows inside a tinted panel, so the group reads as one unit.` (WS1-B-thu, WS1-B-fri).
- **WS2** `Where should Add the usuals live on the Plan page?` Context: `It only appears when it would add at least one meal, and it disappears once the empty days are filled.` Variants: `A: Card above the first day` (recommended) (WS2-A); `B: Button in the header` `Next to Edit and New plan. No room to show what it will add.` (WS2-B); `C: Card at the bottom` `Just above Shop this plan, after you scroll the week.` (WS2-C).
- **WS3** `How should the card look?` Context: `The line counts the empty days it will fill and names each meal, so nothing lands unseen.` Variants: `A: Card with a soft teal button` (recommended) `The same language as the next-step card on Today.` (WS3-A-card, WS2-A); `B: Full-width teal button` `Louder, and it competes with Shop this plan.` (WS3-B-card, WS3-B).
- **WS4** `What should you see after tapping it?` Context: `Shown after it filled three empty days.` Variants: `A: Green status line at the top` (recommended) `The same confirmation every other plan action uses.` (WS4-A); `B: Confirmation in place of the card` `Where your thumb already is. Needs a little extra code.` (WS4-B).
- Reply box: `To decide: reply with pin codes and letters, for example WS1: A · WS2: A · WS3: A · WS4: A. Wording changes go on the same line.`
- Footer "For context": `Already locked: the habit rule (cooked on that weekday in at least 3 of the last 8 times that weekday was planned), both features, no database changes.` · `Habits look back 16 weeks and skip weeks with nothing planned, so a vacation does not erase Thursday chicken.` · if F1 or F2 is still open when you build the board, one line each stating the question and the recommended answer from §2 · `Next: the screens get built to your picks, then a harness proves the behavior and an as-built section is added here.`

**3.4 Run and STOP ①.** Run the capture, then the generator. Hand back: the board path, the 12-file check, the Phase 0 and Phase 1-2 gate results. The orchestrator publishes the board (as a NEW artifact: this is a new review under the project's review-board URL rule, so it must not overwrite an earlier board; later M17 rounds redeploy to that same new URL) and relays the verdicts. Do not continue until it does.

---

## 8. Phase 4: UI, built to the WS verdicts

As in §6, line numbers are those of `main` before any edit: work bottom-up within each file, or anchor on the quoted code.

**Copy (exact; apply any wording the owner gave with the verdicts, verbatim):**
- Group label: `Usually on {Weekday}s` (from `formatDayName`, `lib/date-utils.ts:105-107`; for example `Usually on Thursdays`).
- Card line: `1 empty day has a usual meal.` or `{n} empty days have a usual meal.`
- Card list: each planned usual as `{Ddd}: {recipe name}` (`formatDayAbbrev`, `date-utils.ts:109-111`), joined with `, `, in date order. Plans longer than 7 days repeat weekday abbreviations; accepted.
- Button: `Add the usuals`. Success: `Added 1 usual meal.` or `Added {n} usual meals.` Error fallback: `Failed adding the usuals.`

**4.1 `components/plan-add-meal.tsx`:**
1. Line 3: `import { useEffect, useId, useRef } from "react";`. Line 4: `import { formatDayName, formatDisplayDate } from "@/lib/date-utils";`.
2. Add `| "quickSuggestions"` to the `Pick` list (lines 16-33) and `quickSuggestions` to the destructured props (lines 35-51).
3. Directly after line 52 (`const dialogRef = ...`) add `const usualsLabelId = useId();`. It must stay above the early return at line 95 (hook rules).
4. Between the search `<input>` (ends line 147) and `<div className="quick-add-results">` (line 148) insert:
   ```tsx
            {quickSuggestions.length > 0 ? (
              <div aria-labelledby={usualsLabelId} className="quick-add-usuals" role="group">
                <p className="quick-add-usuals-label" id={usualsLabelId}>
                  Usually on {formatDayName(activeDay)}s
                </p>
                {quickSuggestions.map((recipe) => (
                  <button
                    className="quick-add-row"
                    key={recipe.id}
                    onClick={() => addMeal(activeDay, { slotType: "cook", recipeId: recipe.id, servingMultiplier: 1 })}
                    type="button"
                  >
                    <span>{recipe.name}</span>
                    <span className="muted">Serves {recipe.base_servings}</span>
                  </button>
                ))}
              </div>
            ) : null}
   ```
5. Line 160 becomes `{quickMatches.length === 0 && quickSuggestions.length === 0 ? (` so the "No recipes match" line cannot appear under a showing group. The hint (lines 164-166) is unchanged. The focus trap (lines 58-93) picks up the new buttons by itself.

**4.2 `app/plans/page.tsx`:**
1. Add `quickSuggestions`, `plannedUsuals`, `addUsuals` to the `usePlan` destructure (lines 36-75), and `quickSuggestions` to `addMealShared` (lines 112-128).
2. WS2 A (recommended): insert between the edit sheet block (ends line 295) and the day list (line 297). `formatDayAbbrev` is already imported (line 11).
   ```tsx
        {selectedPlan && plannedUsuals.length > 0 ? (
          <div className="plan-usuals">
            <div className="plan-usuals-text">
              <p className="plan-usuals-line">
                {plannedUsuals.length === 1
                  ? "1 empty day has a usual meal."
                  : `${plannedUsuals.length} empty days have a usual meal.`}
              </p>
              <p className="plan-usuals-list">
                {plannedUsuals.map((usual) => `${formatDayAbbrev(usual.plan_date)}: ${usual.recipe.name}`).join(", ")}
              </p>
            </div>
            <button className="plan-usuals-btn" disabled={saving} onClick={addUsuals} type="button">
              Add the usuals
            </button>
          </div>
        ) : null}
   ```
   WS2 C: the same block between the day list (ends line 313) and the "Shop this plan" link (line 315). WS2 B: no card; inside `.plan-head-meta`, directly before the Edit button (line 141), render `{selectedPlan && plannedUsuals.length > 0 ? (<button className="ghost-btn" disabled={saving} onClick={addUsuals} type="button">Add the usuals</button>) : null}` and add no `.plan-usuals*` CSS.
3. WS4 A (recommended): nothing more; the hook's `setMessage` shows in the existing `StatusMessage` (line 191). WS4 B: `addUsuals` returns `true` on success (and `false` otherwise) and skips `setMessage`; the page keeps `const [usualsDone, setUsualsDone] = useState<string | null>(null)`, sets it to the success copy when the returned value is true, renders `<div className="plan-usuals"><p className="plan-usuals-line success-text">{usualsDone}</p></div>` where the card sits, and clears it in an effect keyed on `message`, `error`, and `selectedPlanId`.

**4.3 `app/globals.css`** (add only; change no existing rule). Every spacing value copies the rule named in its comment.

Takeover group, inserted after `.quick-add-row .muted` (ends line 590), before the hint media query (line 592). Base (WS1 A):

```css
/* "Usually on <Weekday>s" group in the add-meal takeover (milestone 17).
   Rows are plain .quick-add-row buttons; the label borrows the .plan-dhead
   day-label type. */
.quick-add-usuals {
  display: grid;
  gap: 0.4rem; /* = .quick-add-results */
}

.quick-add-usuals-label {
  margin: 0;
  font-size: 0.72rem; /* = .plan-dhead */
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
```

WS1 B adds:

```css
.quick-add-usuals {
  padding: 0.55rem; /* = .quick-add-card */
  border-radius: 12px; /* inner-block radius convention */
  background: var(--color-primary-soft);
}

.quick-add-usuals-label {
  color: var(--brand);
}
```

Card, inserted after `.plan-slot-more .text-btn` (ends line 754), before the takeover comment (line 756). Base (WS3 A):

```css
/* "Add the usuals" card on the Plan page (milestone 17): a day-card skin
   with the Today next-step button (.today-next / .today-next-btn). */
.plan-usuals {
  margin-top: 0.7rem; /* = .plan-dayrow */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem; /* = .today-next */
  padding: 0.7rem 0.9rem; /* = .plan-slot */
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px; /* = .plan-dayrow */
}

.plan-usuals-text {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.15rem; /* = .plan-slot-main */
}

.plan-usuals-line {
  margin: 0;
  font-size: 0.9rem; /* = .today-next-line */
  font-weight: 600;
}

.plan-usuals-list {
  margin: 0;
  color: var(--muted); /* = .plan-slot-sub */
  font-size: 0.75rem;
  font-weight: 500;
}

.plan-usuals-btn {
  flex-shrink: 0;
  min-height: 44px; /* house touch target, = .quick-add-row */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 12px; /* = .today-next-btn */
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--color-primary-soft);
  color: var(--brand);
  cursor: pointer;
}
```

WS3 B replaces the `.plan-usuals` and `.plan-usuals-btn` blocks with:

```css
.plan-usuals {
  margin-top: 0.7rem; /* = .plan-dayrow */
  display: grid;
  gap: 0.45rem; /* design-system grid gap */
}

.plan-usuals-btn {
  width: 100%;
  border: 0;
  border-radius: 12px; /* = .plan-generate */
  padding: 0.9rem;
  font-size: 1rem;
  font-weight: 700;
  background: var(--brand);
  color: var(--surface);
  cursor: pointer;
}
```

Gate after Phase 4: typecheck, lint, vitest 160.

---

## 9. Phase 5: harness, regression re-runs, verification, as-built board

**5.1 `scripts/review-board/verify-weekday-suggestions.mjs` (new).** Same scaffolding, user, pinned clock, seed, and teardown as Phase 3. Add the regenerate-RPC counter route from `verify-shop-pass.mjs:77-82`, and a `meal_plan_items` route like `verify-optimistic-pass.mjs:87-94` that acts on `POST` only (mode `"abort"`: wait 500ms, then `route.abort()`; otherwise `route.continue()`); ignore the browser's resource-load errors during the abort probe, as `verify-optimistic-pass.mjs:97-104` does. Helpers:

```js
const dayCard = (label) =>
  page.locator(".plan-dayrow").filter({ has: page.locator(".plan-dhead span", { hasText: new RegExp(`^${label}$`) }) });
const gotoPlan = async (id) => {
  await page.goto(`${BASE}/plans?plan=${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".plan-dayrow", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
};
const openAdd = async (label) => {
  const card = dayCard(label);
  if (await card.locator(".plan-slot-add").count()) await card.locator(".plan-slot-add").click();
  else await card.locator(".plan-slot-more button").click();
  await page.waitForSelector(".plan-add-meal", { timeout: 8000 });
  await page.waitForTimeout(300);
};
const closeAdd = async () => {
  await page.locator(".plan-add-close").click();
  await page.waitForSelector(".plan-add-meal", { state: "detached", timeout: 8000 });
};
const texts = (selector) => page.locator(selector).evaluateAll((els) => els.map((el) => el.textContent.trim()));
const usualNames = () => texts(".quick-add-usuals .quick-add-row > span:first-child");
const resultNames = () => texts(".quick-add-results .quick-add-row > span:first-child");
const searchBox = () => page.locator('.plan-add-meal input[placeholder="Search recipe..."]');
const usualsButton = () => page.getByRole("button", { name: "Add the usuals" });
const mealRows = (label) => dayCard(label).locator(".plan-slot:not(.empty)");
```

Assertions, in this order (45). Join lists with `" then "` when comparing order.

| # | Step | Expected |
|---|---|---|
| A1 | `gotoPlan(T1)` | `usualsButton()` count 1 |
| A2 | card line (WS2 A or C only) | `3 empty days have a usual meal.` |
| A3 | card list (WS2 A or C only) | `Thu: Crispy Chicken Thighs, Fri: Sheet-Pan Salmon, Tue: Weeknight Tacos` |
| A4 | `openAdd("Oct 5")` (Mon) | `.quick-add-usuals` count 0 (soup 2 of 2, below the bar) |
| A5 | press Enter in `searchBox()` | takeover closes; `mealRows("Oct 5")` count 1 (Enter without a group still adds the top match) |
| A6 | `openAdd("Oct 7")` (Wed) | group count 0 (stew is outside the 16-week window); then `closeAdd()` |
| A7 | `openAdd("Oct 2")` (Fri) | `.quick-add-usuals-label` text `Usually on Fridays` |
| A8 | same | `usualNames()` = `Sheet-Pan Salmon then Baked Cod` |
| A9 | same | `resultNames()` contains neither fish |
| A10 | fill `cod` in `searchBox()` | group count 0 |
| A11 | same | `resultNames()` contains `Baked Cod` |
| A12 | fill `""` | group count 1; then `closeAdd()` |
| A13 | `openAdd("Oct 4")` (Sun, occupied: uses "+ add another meal") | `usualNames()` = `Hurst 15-Bean Soup` only (pasta is outside the last 8); then `closeAdd()` |
| A14 | `openAdd("Oct 6")` (Tue) | `usualNames()` = `Weeknight Tacos` (unplanned weeks do not dilute); then `closeAdd()` |
| A15 | `openAdd("Oct 1")` (Thu) | `usualNames()` = `Crispy Chicken Thighs` |
| A16 | same | `resultNames()` lacks `Crispy Chicken Thighs` |
| A17 | press Enter in `searchBox()` | `.plan-add-meal` count 0 |
| A18 | same | `mealRows("Oct 1")` text contains `Crispy Chicken Thighs` |
| A19 | same | `.success-text` = `Recipe added to plan.` |
| A20 | card line (WS2 A or C) or button (WS2 B) | `2 empty days have a usual meal.` / button count 1 |
| A21 | mode `"abort"`; click `usualsButton()` | within 300ms the Oct 2 card shows `Sheet-Pan Salmon` (optimistic; time it with `waitForFunction` and `{ timeout: 300 }` as `verify-optimistic-pass.mjs:172-180` does) |
| A22 | wait 1200ms | Oct 2 card no longer shows `Sheet-Pan Salmon` |
| A23 | same | Oct 6 card does not show `Weeknight Tacos` |
| A24 | same | `.error-text` count 1 |
| A25 | same | `usualsButton()` count 1 |
| A26 | mode `"normal"`; click `usualsButton()` | `.success-text` = `Added 2 usual meals.` |
| A27 | same | `usualsButton()` count 0 |
| A28 | same | Oct 2 card shows `Sheet-Pan Salmon` and not `Baked Cod` (F1 a) |
| A29 | same | Oct 6 card shows `Weeknight Tacos` |
| A30 | same | `mealRows("Oct 4")` count 1 (the eat-out only) |
| A31 | psql: `count(*)` of T1 items | `5` |
| A32 | psql: T1 items with `slot_type='cook' and meal_type='dinner' and serving_multiplier=1` | `4` |
| B1 | `goto /grocery?plan=<T2>` | `.shop-stale-banner p` = `This plan doesn't have a grocery list yet.` |
| B2 | click `.shop-stale-btn` | `.shop-item` count 2 |
| B3 | same | banner count 0 |
| B4 | psql: T2 `version`, `groceries_version` | equal (record as v0); note the regen counter |
| B5 | `gotoPlan(T2)` | card line `4 empty days have a usual meal.` (WS2 A or C) or button count 1 (WS2 B) |
| B6 | click `usualsButton()` | `.success-text` = `Added 4 usual meals.` |
| B7 | since B4 | regenerate RPC count unchanged |
| B8 | psql | T2 `version` = v0 + 4 |
| B9 | psql | T2 `groceries_version` = v0 |
| B10 | `goto /grocery?plan=<T2>` | `.shop-stale-banner p` = `Your meal plan changed since this list was made.` |
| B11 | same | `.shop-stale-btn` = `Update list` |
| B12 | click it | `.shop-item` count 6 |
| C1 | `gotoPlan(HIST)` | `usualsButton()` count 0 (every day is before today) |

If WS2 B was chosen, A2 and A3 become "button visible" checks and the total stays 45. End with the house summary line; the run must end `45/45 passed, 0 console errors`. Save as-built shots to `scripts/review-board/shots-ws-verify/`: `H1-thu-group.jpg` (after A15), `H2-fri-group.jpg` (after A8), `H3-card.jpg` (after A1), `H4-after-usuals.jpg` (after A26), `H5-shop-update.jpg` (after B11).

**5.2 Verification checklist (record every result; never imply a skipped check passed):**
1. `npm run typecheck`, `npm run lint`, `npm run test`: **160/160 across 10 files**.
2. Timezone runs: `TZ=Pacific/Kiritimati npx vitest run lib/date-utils.test.ts lib/weekday-habits.test.ts` and the same with `TZ=Pacific/Pago_Pago`: 29/29 each (11 + 18).
3. `node scripts/review-board/verify-weekday-suggestions.mjs`: 45/45, 0 console errors.
4. Regression: `verify-optimistic-pass.mjs` 16/16 and `verify-shop-pass.mjs` 22/22 (with the Phase 0 repair), both 0 console errors. No other `verify-*` harness drives the Plan page (`capture.mjs` and `capture-ipad.mjs` visit it for screenshots only; leave them alone).
5. Stop the dev server, then `npm run build` green. Run `rm -rf .next` before any later harness run.
6. Static checks: `rtk proxy git diff main --stat` lists only §11's allowed files; `rtk proxy git diff main -- supabase package.json package-lock.json docs` is empty; `rtk proxy git diff main | grep '^+' | grep -c '—'` prints 0; `grep -nE '#[0-9a-fA-F]{3,8}' app/globals.css` hits only the `:root` token lines; the recency query `select("recipe_id, created_at")` ... `.limit(200)` is unchanged in `git diff main -- lib/hooks/use-plan.ts`.
7. Extend `gen-board-ws.mjs` with an "As built" section (no pins) that appears when `shots-ws-verify/` exists: H1-H5 with one-line captions. Regenerate the board for the orchestrator to redeploy in place.
8. Needs-Mitchell (owner-run, not blocking the merge unless he says so): on `npm run dev:phone`, never the deployed site, open the add screen on a habit day with the iPhone keyboard up and confirm the group and the first regular rows are visible; tap a usual; tap Add the usuals on a new week. Playwright WebKit is not Safari.

Then STOP ②: hand back the summary (files changed, all results above, the board path). Suggested commits for the orchestrator (Conventional Commits, no trailers): `test: pin harness clocks to their July seeds and follow the add-meal takeover` (Phase 0) · `feat: suggest weekday habits when adding a meal and add the usuals in one tap` (lib, hook, UI, CSS) · `test: add the weekday-suggestions harness and board tooling` (seed, capture, board, harness).

---

## 10. Acceptance

- Opening the add screen on a weekday with habits shows `Usually on <Weekday>s` with at most 3 recipes above the results, only while the search box is empty; days without habits show nothing new; nothing appears twice.
- Enter adds the first usual when the group shows, otherwise the top match; Shift+Enter does the same and moves to the next day. Typed searches behave exactly as before.
- The Plan page shows Add the usuals only when it would add at least one meal. One tap fills each empty day on or after today with its top usual in one atomic insert; occupied days and past days are untouched; the success line carries the count; a failed write removes only the new rows and shows the red error.
- After Add the usuals, Shop shows the stale banner and the updated list contains the new meals; no regeneration call was added.
- The habit rule matches §2 exactly (vitest-proven, timezone-proof).
- No schema change, no new dependency, tokens-only CSS, no em-dashes in new copy; WS1-WS4 verdicts applied.
- vitest 160 across 10 files; the M17 harness 45/45; the two repaired harnesses 16/16 and 22/22; build green.

## 11. Do-not-touch list

- `supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, `package.json`, `package-lock.json`, `docs/**`.
- `lib/grocery.ts`, `lib/hooks/use-grocery-list.ts`, `lib/hooks/use-today.ts`, `lib/hooks/use-recipes.ts`, `lib/hooks/use-import.ts`, `app/page.tsx`, `app/grocery/page.tsx`, `app/recipes/**`, `app/settings/**`, `components/cook-mode.tsx` (M18 territory), `components/plan-day-items.tsx`.
- In `lib/hooks/use-plan.ts`, everything outside §6's ten edits, explicitly: the recency query and its handling (lines 217-222, 263-268), `createPlan`, `savePlanMeta`, `addMeal`, `removeItem`, `deleteSelectedPlan`, `adjustServing`, `openQuickAdd`, `refreshPlansAndKeepSelection`, the deep-link and selection effects, and every existing return key.
- In `app/globals.css`: no existing rule changes. Leave the dead `.quick-add-card` rule (lines 545-552) for a separate cleanup.
- In `scripts/review-board/`: existing scripts change only by the Phase 0 lines. `capture-shop-variants.mjs` keeps its stale selector (a finished SB1 capture).
- Existing copy stays: the Plan page's "No plans in this view yet ..." line (`app/plans/page.tsx:194`) and the takeover hint (`components/plan-add-meal.tsx:164-166`).

Files this milestone may change: `lib/date-utils.ts`, `lib/date-utils.test.ts`, `lib/weekday-habits.ts` (new), `lib/weekday-habits.test.ts` (new), `lib/hooks/use-plan.ts`, `components/plan-add-meal.tsx`, `app/plans/page.tsx`, `app/globals.css`, `scripts/review-board/{seed-weekday-suggestions.sql, capture-ws-variants.mjs, gen-board-ws.mjs, verify-weekday-suggestions.mjs}` (new), `scripts/review-board/verify-optimistic-pass.mjs` and `verify-shop-pass.mjs` (Phase 0 lines only).

## 12. Docs to update on wrap (orchestrator only)

- `docs/current-state.md`, `docs/progress-log.md`, `docs/roadmap.md` (M17 status).
- `docs/decisions.md`: R1-R14 in brief (16-week window, occurrence definition, ranking, cap, top-one rule), the F1/F2 answers, the WS verdicts.
- `docs/design-system.md` "Plan components": `.quick-add-usuals`, `.quick-add-usuals-label`, `.plan-usuals*` as built.
- `docs/pages/plans.md`: the suggestion group, Add the usuals, the new history read. The page doc is already stale (it still describes `upsertPlanSlot`, `clearSlot`, Backspace-clears-slot, and "Generate grocery list"); refresh it in the same pass.
- `docs/architecture.md`: vitest 160 across 10 files; the new harness.
- `scripts/review-board/README.md`: a "Milestone 17 additions" section (the clock-pin technique, the dedicated `wsverify@local.test` user, the new scripts, the Phase 0 repairs).
- `docs/design-flags.md`: only if the builder reported a missing value.

---

## Appendix A: prod preview of the rule (orchestrator only; read-only; optional)

Shows which habits the rule finds on live data today, for example to tell the owner whether Friday's fish qualify (which decides whether F1 matters yet). SELECT only; never the builder. Supabase's `current_date` is UTC, so the window edge may differ from the app by a day.

```sql
-- M17 habit preview. Mirrors lib/weekday-habits.ts: window = the 112 days
-- before today (today excluded); occurrence = a date with at least one
-- meal_plan_items row; last 8 occurrences per weekday; habit = cooked on >= 3.
with params as (
  select current_date - 112 as win_start, current_date as today
),
win as (
  select i.plan_date, i.slot_type, i.recipe_id
  from public.meal_plan_items i, params p
  where i.plan_date >= p.win_start and i.plan_date < p.today
),
occ as (
  select plan_date,
         extract(dow from plan_date)::int as dow,
         row_number() over (partition by extract(dow from plan_date) order by plan_date desc) as rn
  from (select distinct plan_date from win) d
),
last8 as (select plan_date, dow from occ where rn <= 8),
cooked as (select distinct plan_date, recipe_id from win where slot_type = 'cook')
select to_char(date '2026-01-04' + l.dow, 'Dy') as weekday,  -- 2026-01-04 is a Sunday
       r.name,
       count(*) as cooked_on,
       (select count(*) from last8 x where x.dow = l.dow) as occurrences,
       max(l.plan_date) as last_cooked
from last8 l
join cooked c on c.plan_date = l.plan_date
join public.recipes r on r.id = c.recipe_id
group by l.dow, r.id, r.name
having count(*) >= 3
order by l.dow, cooked_on desc, last_cooked asc, r.name;
```

## Appendix B: reference index (checked against `main` `0dcabab`, 2026-10-02)

| Where | What |
|---|---|
| `lib/hooks/use-plan.ts:89` | `recentRecipeIds` state |
| `use-plan.ts:107` | `todayYmd` memo |
| `use-plan.ts:128` | `itemById` |
| `use-plan.ts:130-140` | `quickMatches` (recency ranking, top 8) |
| `use-plan.ts:142-153` | `quickLeftoverOptions` |
| `use-plan.ts:202-271` | `loadInitialData`; `Promise.all` 206-223; recency query 217-222; failure check 225-229; recency handling 263-268 |
| `use-plan.ts:273-307` | `loadPlanItems` (`setItems` 286-306) |
| `use-plan.ts:383-495` | `addMeal` (optimistic, M10); `meal_type: "dinner"` 451-454 |
| `use-plan.ts:607-638` | `handleQuickAddKeyDown`; Enter target line 616 |
| `use-plan.ts:640-680` | hook return object |
| `components/plan-add-meal.tsx:16-33, 52, 58-93, 95, 139-168` | props `Pick`; `dialogRef`; scroll lock, Escape, focus trap; early return; Cook-mode block (input 141-147, results 148-163, no-match 160-162, hint 164-166) |
| `app/plans/page.tsx:36-75, 112-128, 191, 247-295, 297-313, 315-319` | hook destructure; `addMealShared`; `StatusMessage`; edit sheet; day list; "Shop this plan" |
| `components/plan-day-items.tsx:72-90` | empty day (+) with `aria-label="Add a meal on {Mon D}"`; "+ add another meal" |
| `lib/date-utils.ts:14-17, 30-34, 51-61, 88-91, 105-111` | private `parseYmd`; `addDays`; `dateRange`; `nextDayInRange`; `formatDayName`, `formatDayAbbrev` |
| `supabase/schema.sql:104-125` | `meal_plan_items` (meal_type 108, slot_type 109, recipe FK cascade 110, multiplier 113, checks 116-124) |
| `schema.sql:247-260, 460-535, 570-612` | items RLS policy; `validate_meal_plan_item`; `bump_plan_version_on_grocery_change` |
| `app/globals.css:545-552, 560-597, 663-754, 800-822, 1223-1249, 1457-1465` | dead `.quick-add-card`; quick-add rows and hint; plan day rows and slots; takeover body and `.plan-generate`; Today next-step card; card label |
| `lib/hooks/use-grocery-list.ts:77-84, 136-138` | Shop loads plans with `end_date >= today`; stale flag |
| `app/grocery/page.tsx:147-163` | stale banner copy and button labels |
| `scripts/review-board/verify-shop-pass.mjs:47-59, 77-82, 84, 159-163` | July seed; regen RPC counter; `newPage`; stale `.quick-add-card` waits |
| `scripts/review-board/verify-optimistic-pass.mjs:47-62, 87-94, 96, 97-104, 112` | July seed; write-mode route; `newPage`; console filter; local-only password literal |
