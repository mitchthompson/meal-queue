// Friendly error mapping for the Supabase/PostgREST errors the UI surfaces.
//
// P0001 (raise_exception) messages come from our own database functions and
// triggers (save_recipe, validate_meal_plan_item, regenerate_grocery_list...)
// and are written to be human-readable — pass them through verbatim. Common
// constraint/permission codes get a friendly translation; anything else still
// surfaces its raw message (better than hiding it) with the caller's fallback
// as the last resort.
const CODE_MESSAGES: Record<string, string> = {
  "23505": "That already exists — try a different name.",
  "23503": "That can't be saved because something it references is missing.",
  "23514": "One of the values isn't allowed — check amounts and dates.",
  "42501": "You don't have permission to do that.",
  PGRST202: "The app is ahead of the database — refresh and try again.",
};

export function toErrorMessage(caught: unknown, fallback: string): string {
  const err = caught as { message?: unknown; code?: unknown } | null;
  const code = typeof err?.code === "string" ? err.code : null;
  const message = typeof err?.message === "string" ? err.message : null;

  if (code === "P0001" && message) return message;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (message) return message;
  return fallback;
}
