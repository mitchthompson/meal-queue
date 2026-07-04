// System + user prompt construction for the Haiku recipe parser.
import { DEFAULT_UNITS } from "../constants";
import { COMMON_PANTRY_STAPLES } from "./pantry-staples";

// "tsp (teaspoon), tbsp (tablespoon), ..." — meanings come from the app's
// canonical unit list so the prompt and the DB vocabulary never diverge.
const UNIT_LIST = DEFAULT_UNITS.map((u) => `${u.code} (${u.label})`).join(", ");

export function buildSystemPrompt(existingTags: string[]): string {
  const tagLine =
    existingTags.length > 0
      ? `Choose 0-3 tags ONLY from this list, verbatim: ${existingTags.join(", ")}. If none fit, use []. Never invent a tag.`
      : "There are no tags to choose from. Use [] for tags. Never invent a tag.";

  return [
    "You extract exactly one recipe from messy web or pasted content into strict JSON. Output only what the schema allows.",
    "",
    `UNITS. Use one of these unit codes for every ingredient: ${UNIT_LIST}. Any other unit (can, package, bunch, pinch, head, stalk, sprig...) uses unit_code:"item" and folds the qualifier into the name, e.g. black beans (15-oz can).`,
    "",
    'AMOUNTS. Use decimals only. Convert fractions ("1 1/2" -> 1.5, "¾" -> 0.75). Ranges take the upper bound ("2-3 tbsp" -> 3). "to taste" / "pinch" / "as needed" -> amount: 0 (and usually is_pantry_staple: true).',
    "",
    `PANTRY. Set is_pantry_staple:true if the ingredient is or closely matches one of these common pantry staples: ${COMMON_PANTRY_STAPLES.join(", ")}.`,
    "",
    `TAGS. ${tagLine}`,
    "",
    'BASE_SERVINGS. Use the stated yield. "serves 4-6" -> 4 (lower bound). If absent, use 4.',
    "",
    "STEPS. One imperative string per step. No leading numbers. Stay close to the source wording.",
    "",
    'Ignore ads, comments, navigation, and story preamble. If there is no actual recipe in the content, return {"no_recipe": true}.',
  ].join("\n");
}

export function buildUserContent(
  kind: "json-ld" | "text" | "paste",
  content: string,
  title?: string | null,
): string {
  if (kind === "json-ld") {
    return `SOURCE (schema.org JSON-LD):\n${content}`;
  }
  if (kind === "text") {
    const label = title ? `page text, title: ${title}` : "page text";
    return `SOURCE (${label}):\n${content}`;
  }
  return `SOURCE (pasted by the user):\n${content}`;
}
