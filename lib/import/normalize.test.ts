import { describe, expect, it } from "vitest";
import {
  clampUnitCode,
  dedupeIngredients,
  normalizeAmount,
  normalizeDraft,
  normalizeServings,
  sanitizeTags,
} from "./normalize";
import { VALID_UNIT_CODES } from "./schema";

describe("clampUnitCode", () => {
  const aliases: [string, string][] = [
    ["tablespoon", "tbsp"],
    ["tablespoons", "tbsp"],
    ["teaspoon", "tsp"],
    ["teaspoons", "tsp"],
    ["pound", "lb"],
    ["pounds", "lb"],
    ["gram", "g"],
    ["grams", "g"],
    ["kilogram", "kg"],
    ["kilograms", "kg"],
    ["ounce", "oz"],
    ["ounces", "oz"],
    ["fluid ounce", "fl_oz"],
    ["fl oz", "fl_oz"],
    ["liter", "l"],
    ["litre", "l"],
    ["milliliter", "ml"],
    ["millilitre", "ml"],
    ["cups", "cup"],
    ["cloves", "clove"],
    ["slices", "slice"],
    ["each", "item"],
    ["piece", "item"],
    ["whole", "item"],
  ];

  it.each(aliases)("maps %s -> %s", (input, expected) => {
    expect(clampUnitCode(input)).toBe(expected);
  });

  it("passes canonical codes through unchanged", () => {
    for (const code of VALID_UNIT_CODES) expect(clampUnitCode(code)).toBe(code);
  });

  it("falls back to item for unknown or empty units", () => {
    expect(clampUnitCode("smidgen")).toBe("item");
    expect(clampUnitCode("")).toBe("item");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(clampUnitCode("  TABLESPOON ")).toBe("tbsp");
  });
});

describe("normalizeAmount", () => {
  it("keeps finite non-negative numbers, rounded to 3 decimals", () => {
    expect(normalizeAmount(1.5)).toBe(1.5);
    expect(normalizeAmount(0.66666)).toBe(0.667);
  });

  it("floors negatives, non-finite, and junk to 0", () => {
    expect(normalizeAmount(-1)).toBe(0);
    expect(normalizeAmount(Infinity)).toBe(0);
    expect(normalizeAmount(NaN)).toBe(0);
    expect(normalizeAmount("abc")).toBe(0);
  });

  it("coerces numeric strings", () => {
    expect(normalizeAmount("2.5")).toBe(2.5);
  });
});

describe("normalizeServings", () => {
  it("defaults invalid input to 4", () => {
    expect(normalizeServings(0)).toBe(4);
    expect(normalizeServings(-3)).toBe(4);
    expect(normalizeServings(NaN)).toBe(4);
    expect(normalizeServings("x")).toBe(4);
  });

  it("clamps to 1..24", () => {
    expect(normalizeServings(100)).toBe(24);
    expect(normalizeServings(0.4)).toBe(1);
  });

  it("rounds to the nearest 0.5", () => {
    expect(normalizeServings(4.3)).toBe(4.5);
    expect(normalizeServings(6)).toBe(6);
  });
});

describe("sanitizeTags", () => {
  const allowed = ["Breakfast", "under-30-min", "Chicken"];

  it("intersects case-insensitively and returns canonical casing", () => {
    expect(sanitizeTags(["breakfast", "CHICKEN"], allowed)).toEqual([
      "Breakfast",
      "Chicken",
    ]);
  });

  it("drops unknown tags and dedupes", () => {
    expect(sanitizeTags(["breakfast", "breakfast", "dessert"], allowed)).toEqual([
      "Breakfast",
    ]);
  });

  it("caps at 5", () => {
    const many = Array.from({ length: 8 }, (_, i) => `t${i}`);
    expect(sanitizeTags(many, many).length).toBe(5);
  });
});

describe("dedupeIngredients", () => {
  it("keeps the first row per (lower name, unit_code)", () => {
    const out = dedupeIngredients([
      { name: "Onion", amount: 1, unit_code: "item" },
      { name: "onion", amount: 2, unit_code: "item" },
      { name: "Onion", amount: 3, unit_code: "cup" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].amount).toBe(1);
  });
});

describe("normalizeDraft", () => {
  const raw = {
    name: "  Pancakes ",
    base_servings: 4,
    tags: ["breakfast", "invented"],
    ingredients: [
      { name: "flour", amount: 2, unit_code: "cups", is_pantry_staple: true },
      { name: "salt", amount: 0, unit_code: "pinch", is_pantry_staple: true },
      { name: "  ", amount: 1, unit_code: "item", is_pantry_staple: false },
    ],
    steps: ["1. Mix everything", "Step 2: Fry in butter", "   "],
  };

  it("normalizes units, trims, drops empties, strips step numbering", () => {
    const draft = normalizeDraft(raw, ["breakfast"], null, "orig text");
    expect(draft.name).toBe("Pancakes");
    expect(draft.tags).toEqual(["breakfast"]);
    expect(draft.ingredients).toHaveLength(2);
    expect(draft.ingredients[0].unit_code).toBe("cup"); // cups -> cup
    expect(draft.ingredients[1].unit_code).toBe("item"); // pinch -> item
    expect(draft.steps).toEqual(["Mix everything", "Fry in butter"]);
    expect(draft.instructions_raw).toBe("orig text");
  });

  it("prepends the Source line when a URL is given", () => {
    const draft = normalizeDraft(raw, [], "https://x.com/r", "orig text");
    expect(draft.instructions_raw).toBe("Source: https://x.com/r\n\norig text");
  });

  it("throws when no ingredient survives cleanup", () => {
    expect(() =>
      normalizeDraft(
        { ...raw, ingredients: [{ name: "", amount: 1, unit_code: "item", is_pantry_staple: false }] },
        [],
        null,
        "t",
      ),
    ).toThrow();
  });

  it("throws when the name is empty after trim", () => {
    expect(() => normalizeDraft({ ...raw, name: "   " }, [], null, "t")).toThrow();
  });
});
