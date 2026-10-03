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
