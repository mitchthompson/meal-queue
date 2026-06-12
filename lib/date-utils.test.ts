import { describe, expect, it } from "vitest";
import {
  addDays,
  createDefaultsFromStart,
  dateRange,
  findNextAvailableStartDate,
  nextDayInRange,
  nextWeekday,
  toYmd,
  weekdayOnOrBefore,
} from "./date-utils";

describe("date utilities", () => {
  it("formats local calendar fields without UTC date shifts", () => {
    const date = new Date(2026, 0, 2, 23, 30);
    expect(toYmd(date)).toBe("2026-01-02");
  });

  it("adds days across month, year, and daylight-saving boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(dateRange("2026-03-07", "2026-03-10")).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ]);
  });

  it("returns an empty range when the end precedes the start", () => {
    expect(dateRange("2026-06-10", "2026-06-09")).toEqual([]);
    expect(dateRange("", "")).toEqual([]);
  });

  it("finds weekdays relative to a deterministic starting date", () => {
    const monday = new Date(2026, 5, 8);
    expect(nextWeekday(1, monday)).toBe("2026-06-08");
    expect(nextWeekday(5, monday)).toBe("2026-06-12");
    expect(weekdayOnOrBefore("2026-06-12", 3)).toBe("2026-06-10");
    expect(weekdayOnOrBefore("2026-06-12", 5)).toBe("2026-06-12");
  });

  it("creates plan defaults from the configured duration and grocery weekdays", () => {
    expect(
      createDefaultsFromStart("2026-06-12", {
        default_plan_days: 7,
        default_order_weekday: 3,
        default_pickup_weekday: 4,
      }),
    ).toEqual({
      start_date: "2026-06-12",
      end_date: "2026-06-18",
      order_date: "2026-06-10",
      pickup_date: "2026-06-11",
    });
  });

  it("skips start dates already used by plans", () => {
    const fromDate = new Date(2026, 5, 8);
    expect(
      findNextAvailableStartDate(
        5,
        [{ start_date: "2026-06-12" }, { start_date: "2026-06-19" }],
        fromDate,
      ),
    ).toBe("2026-06-26");
  });

  it("returns the next day only while it remains in range", () => {
    expect(nextDayInRange("2026-06-11", "2026-06-12")).toBe("2026-06-12");
    expect(nextDayInRange("2026-06-12", "2026-06-12")).toBeNull();
  });
});
