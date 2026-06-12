import { describe, expect, it } from "vitest";
import { buildGroceryRows, formatAmount, scaleIngredientAmount } from "./grocery";

describe("grocery generation", () => {
  it("scales and combines matching ingredients across repeated recipes", () => {
    const rows = buildGroceryRows(
      { id: "plan-1", version: 4 },
      [
        { recipe_id: "recipe-1", serving_multiplier: 1 },
        { recipe_id: "recipe-1", serving_multiplier: 1.5 },
      ],
      [
        {
          recipe_id: "recipe-1",
          name: "Rice",
          amount: 1,
          unit_code: "cup",
          is_pantry_staple: false,
        },
      ],
    );

    expect(rows).toEqual([
      {
        meal_plan_id: "plan-1",
        ingredient_name: "Rice",
        amount: 2.5,
        unit_code: "cup",
        is_pantry_staple: false,
        source_key: "v4|rice|cup|0",
        is_on_hand: false,
        is_checked: false,
      },
    ]);
  });

  it("normalizes whitespace and casing while preserving the first display name", () => {
    const rows = buildGroceryRows(
      { id: "plan-1", version: 1 },
      [
        { recipe_id: "recipe-1", serving_multiplier: 1 },
        { recipe_id: "recipe-2", serving_multiplier: 1 },
      ],
      [
        {
          recipe_id: "recipe-1",
          name: "  Olive Oil ",
          amount: 1,
          unit_code: "tbsp",
          is_pantry_staple: true,
        },
        {
          recipe_id: "recipe-2",
          name: "olive oil",
          amount: 2,
          unit_code: "tbsp",
          is_pantry_staple: true,
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ingredient_name: "Olive Oil",
      amount: 3,
      source_key: "v1|olive oil|tbsp|1",
    });
  });

  it("keeps different units and pantry classifications in separate buckets", () => {
    const rows = buildGroceryRows(
      { id: "plan-1", version: 1 },
      [{ recipe_id: "recipe-1", serving_multiplier: 1 }],
      [
        { recipe_id: "recipe-1", name: "Salt", amount: 1, unit_code: "tsp", is_pantry_staple: true },
        { recipe_id: "recipe-1", name: "Salt", amount: 2, unit_code: "tbsp", is_pantry_staple: true },
        { recipe_id: "recipe-1", name: "Salt", amount: 3, unit_code: "tsp", is_pantry_staple: false },
      ],
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.source_key)).toEqual([
      "v1|salt|tsp|1",
      "v1|salt|tbsp|1",
      "v1|salt|tsp|0",
    ]);
  });

  it("ignores plan items without recipes and rounds final totals to three decimals", () => {
    const rows = buildGroceryRows(
      { id: "plan-1", version: 2 },
      [
        { recipe_id: null, serving_multiplier: 1 },
        { recipe_id: "recipe-1", serving_multiplier: 1 / 3 },
      ],
      [
        {
          recipe_id: "recipe-1",
          name: "Flour",
          amount: 1,
          unit_code: "cup",
          is_pantry_staple: false,
        },
      ],
    );

    expect(rows[0].amount).toBe(0.333);
  });
});

describe("ingredient amounts", () => {
  it("scales quantities and preserves the existing fallback multiplier", () => {
    expect(scaleIngredientAmount(2, 1.5)).toBe(3);
    expect(scaleIngredientAmount(2, 0)).toBe(2);
  });

  it("formats amounts with at most three decimal places", () => {
    expect(formatAmount(2)).toBe("2");
    expect(formatAmount(1.23456)).toBe("1.235");
  });
});
