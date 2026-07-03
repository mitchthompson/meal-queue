export const STARTER_TAGS = [
  "chicken",
  "beef",
  "seafood",
  "vegetarian",
  "italian",
  "mexican",
  "stir-fry",
  "sheet-pan",
  "slow-cooker",
  "under-30-min",
];

export const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const DEFAULT_UNITS = [
  { code: "tsp", label: "teaspoon" },
  { code: "tbsp", label: "tablespoon" },
  { code: "cup", label: "cup" },
  { code: "fl_oz", label: "fluid ounce" },
  { code: "ml", label: "milliliter" },
  { code: "l", label: "liter" },
  { code: "oz", label: "ounce" },
  { code: "lb", label: "pound" },
  { code: "g", label: "gram" },
  { code: "kg", label: "kilogram" },
  { code: "item", label: "item" },
  { code: "clove", label: "clove" },
  { code: "slice", label: "slice" },
];

export type UserSettingsDefaults = {
  default_plan_days: number;
  week_starts_on: number;
  default_order_weekday: number | null;
  default_pickup_weekday: number | null;
};

// Canonical client-side defaults for user_settings — the single source of
// truth. Mirrors the SQL column defaults in supabase/schema.sql: plan_days 7,
// week_starts_on 5, and order/pickup weekday left unset (null) so the user
// picks their own days. Do not re-inline these values.
export const DEFAULT_USER_SETTINGS: UserSettingsDefaults = {
  default_plan_days: 7,
  week_starts_on: 5,
  default_order_weekday: null,
  default_pickup_weekday: null,
};
