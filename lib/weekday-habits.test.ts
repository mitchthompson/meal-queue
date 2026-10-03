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

describe("habitWindowStart", () => {
  it("starts the window 112 days (16 weeks) before today", () => {
    expect(habitWindowStart(TODAY)).toBe("2026-06-10");
  });
});

describe("weekdayHabits", () => {
  it("finds a recipe cooked on all of the last 8 Thursdays", () => {
    const history = THU8.map((d) => cook(d, "chicken"));
    expect(weekdayHabits(history, 4, TODAY, RECIPES)).toEqual([
      { recipe: recipe("chicken"), cookedOn: 8, occurrences: 8, lastCooked: "2026-09-24" },
    ]);
  });

  it("needs at least 3 cooks among the last 8 occurrences", () => {
    const history = [
      ...["2026-09-24", "2026-09-10", "2026-08-27"].map((d) => cook(d, "chicken")),
      ...["2026-09-17", "2026-09-03"].map((d) => cook(d, "salmon")),
      ...["2026-08-20", "2026-08-13", "2026-08-06"].map(eatOut),
    ];
    // salmon at 2 cooks is left out
    expect(weekdayHabits(history, 4, TODAY, RECIPES)).toEqual([
      { recipe: recipe("chicken"), cookedOn: 3, occurrences: 8, lastCooked: "2026-09-24" },
    ]);
  });

  it("counts only dates with a planned meal, so unplanned weeks do not dilute a habit", () => {
    const history = ["2026-07-21", "2026-07-14", "2026-07-07"].map((d) => cook(d, "tacos"));
    expect(weekdayHabits(history, 2, TODAY, RECIPES)).toEqual([
      { recipe: recipe("tacos"), cookedOn: 3, occurrences: 3, lastCooked: "2026-07-21" },
    ]);
  });

  it("looks at the 8 most recent occurrences only", () => {
    const history = [
      ...SUN8.map(eatOut),
      ...["2026-08-02", "2026-07-26", "2026-07-19"].map((d) => cook(d, "pasta")),
    ];
    expect(weekdayHabits(history, 0, TODAY, RECIPES)).toEqual([]);
  });

  it("counts eat-out and leftover days as occurrences but never counts leftovers as cooks", () => {
    const history = [
      ...["2026-09-27", "2026-09-13", "2026-08-30"].map((d) => cook(d, "beans")),
      ...["2026-09-20", "2026-09-06", "2026-08-23"].map((d) => leftover(d, "soup")),
    ];
    expect(weekdayHabits(history, 0, TODAY, RECIPES)).toEqual([
      { recipe: recipe("beans"), cookedOn: 3, occurrences: 6, lastCooked: "2026-09-27" },
    ]);
  });

  it("includes the window's first day and ignores anything earlier", () => {
    const firstDayIncluded = ["2026-06-10", "2026-06-17", "2026-06-24"].map((d) => cook(d, "stew"));
    expect(weekdayHabits(firstDayIncluded, 3, TODAY, RECIPES)).toEqual([
      { recipe: recipe("stew"), cookedOn: 3, occurrences: 3, lastCooked: "2026-06-24" },
    ]);
    const oneDayTooEarly = ["2026-06-03", "2026-06-17", "2026-06-24"].map((d) => cook(d, "stew"));
    expect(weekdayHabits(oneDayTooEarly, 3, TODAY, RECIPES)).toEqual([]);
  });

  it("ignores today and future dates", () => {
    const history = ["2026-09-30", "2026-10-07", "2026-10-14"].map((d) => cook(d, "stew"));
    expect(weekdayHabits(history, 3, TODAY, RECIPES)).toEqual([]);
  });

  it("counts a recipe once per date even when it is planned twice that day", () => {
    const twiceThatDay = [cook("2026-09-24", "chicken"), cook("2026-09-24", "chicken"), cook("2026-09-17", "chicken")];
    expect(weekdayHabits(twiceThatDay, 4, TODAY, RECIPES)).toEqual([]);
    const plusAThird = [...twiceThatDay, cook("2026-09-10", "chicken")];
    expect(weekdayHabits(plusAThird, 4, TODAY, RECIPES)).toEqual([
      { recipe: recipe("chicken"), cookedOn: 3, occurrences: 3, lastCooked: "2026-09-24" },
    ]);
  });

  it("ranks by cook count, then the habit cooked longest ago, then name", () => {
    const result = weekdayHabits(RANKED_FRIDAYS, 5, TODAY, RECIPES);
    expect(names(result.map((h) => h.recipe))).toEqual([
      "Pizza Night",
      "Sheet-Pan Salmon",
      "Baked Cod",
      "Coconut Rice",
      "Garlic Greens",
    ]);
  });

  it("keeps weekdays separate", () => {
    const history = THU8.map((d) => cook(d, "chicken"));
    expect(weekdayHabits(history, 3, TODAY, RECIPES)).toEqual([]);
    expect(weekdayHabits(history, 5, TODAY, RECIPES)).toEqual([]);
  });

  it("drops recipes that are no longer in the recipe list", () => {
    const history = THU8.map((d) => cook(d, "deleted"));
    expect(weekdayHabits(history, 4, TODAY, RECIPES)).toEqual([]);
  });
});

describe("suggestionsForDay", () => {
  it("returns at most 3 recipes for the day's weekday, in rank order", () => {
    const result = suggestionsForDay(RANKED_FRIDAYS, "2026-10-02", TODAY, RECIPES);
    expect(names(result)).toEqual(["Pizza Night", "Sheet-Pan Salmon", "Baked Cod"]);
  });

  it("leaves out recipes already planned that day, before applying the cap", () => {
    const result = suggestionsForDay(RANKED_FRIDAYS, "2026-10-02", TODAY, RECIPES, new Set(["pizza"]));
    expect(names(result)).toEqual(["Sheet-Pan Salmon", "Baked Cod", "Coconut Rice"]);
  });

  it("returns nothing for a weekday without habits", () => {
    const history = THU8.map((d) => cook(d, "chicken"));
    expect(suggestionsForDay(history, "2026-10-05", TODAY, RECIPES)).toEqual([]);
  });
});

describe("planUsuals", () => {
  it("puts the top habit on each empty day of the plan", () => {
    const result = planUsuals({
      planStart: "2026-10-01",
      planEnd: "2026-10-07",
      todayYmd: TODAY,
      occupiedDates: new Set(["2026-10-04"]),
      history: WEEK,
      recipes: RECIPES,
    });
    expect(result).toEqual([
      { plan_date: "2026-10-01", recipe: recipe("chicken") },
      { plan_date: "2026-10-02", recipe: recipe("salmon") },
      { plan_date: "2026-10-06", recipe: recipe("tacos") },
    ]);
  });

  it("skips occupied days and days before today", () => {
    // Tue 09-29 would get tacos if past days were not skipped.
    const result = planUsuals({
      planStart: "2026-09-28",
      planEnd: "2026-10-04",
      todayYmd: TODAY,
      occupiedDates: new Set(["2026-10-02", "2026-10-04"]),
      history: WEEK,
      recipes: RECIPES,
    });
    expect(result).toEqual([{ plan_date: "2026-10-01", recipe: recipe("chicken") }]);
  });

  it("fills every matching weekday in a plan longer than a week", () => {
    const result = planUsuals({
      planStart: "2026-10-01",
      planEnd: "2026-10-14",
      todayYmd: TODAY,
      occupiedDates: new Set<string>(),
      history: WEEK,
      recipes: RECIPES,
    });
    expect(result).toEqual([
      { plan_date: "2026-10-01", recipe: recipe("chicken") },
      { plan_date: "2026-10-02", recipe: recipe("salmon") },
      { plan_date: "2026-10-04", recipe: recipe("beans") },
      { plan_date: "2026-10-06", recipe: recipe("tacos") },
      { plan_date: "2026-10-08", recipe: recipe("chicken") },
      { plan_date: "2026-10-09", recipe: recipe("salmon") },
      { plan_date: "2026-10-11", recipe: recipe("beans") },
      { plan_date: "2026-10-13", recipe: recipe("tacos") },
    ]);
  });
});
