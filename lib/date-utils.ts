export type PlanDateSettings = {
  default_plan_days: number;
  default_order_weekday: number | null;
  default_pickup_weekday: number | null;
};

export type PlanDateForm = {
  start_date: string;
  end_date: string;
  order_date: string;
  pickup_date: string;
};

function parseYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isYmd(ymd: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

export function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(ymd: string, days: number) {
  const date = parseYmd(ymd);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

export function nextWeekday(weekday: number, fromDate = new Date()) {
  const date = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  return toYmd(date);
}

export function weekdayOnOrBefore(startDate: string, weekday: number) {
  const date = parseYmd(startDate);
  let delta = weekday - date.getDay();
  if (delta > 0) delta -= 7;
  date.setDate(date.getDate() + delta);
  return toYmd(date);
}

export function dateRange(start: string, end: string) {
  if (!isYmd(start) || !isYmd(end) || end < start) return [];

  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function createDefaultsFromStart(startDate: string, settings: PlanDateSettings): PlanDateForm {
  return {
    start_date: startDate,
    end_date: addDays(startDate, settings.default_plan_days - 1),
    order_date:
      settings.default_order_weekday === null ? "" : weekdayOnOrBefore(startDate, settings.default_order_weekday),
    pickup_date:
      settings.default_pickup_weekday === null ? "" : weekdayOnOrBefore(startDate, settings.default_pickup_weekday),
  };
}

export function findNextAvailableStartDate(
  weekday: number,
  plans: Array<{ start_date: string }>,
  fromDate = new Date(),
) {
  const usedStartDates = new Set(plans.map((plan) => plan.start_date));
  let candidate = nextWeekday(weekday, fromDate);
  for (let i = 0; i < 120; i += 1) {
    if (!usedStartDates.has(candidate)) return candidate;
    candidate = addDays(candidate, 7);
  }
  return candidate;
}

export function nextDayInRange(day: string, endDate: string) {
  const next = addDays(day, 1);
  return next <= endDate ? next : null;
}
