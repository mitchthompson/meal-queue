import { describe, expect, it } from "vitest";
import { draftToFormState } from "./draft-to-form";
import type { RecipeDraft } from "../import/schema";

const UNITS = [
  { code: "cup", label: "cup" },
  { code: "tbsp", label: "tablespoon" },
  { code: "item", label: "item" },
  { code: "g", label: "gram" },
];

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    name: "Pancakes",
    base_servings: 4,
    instructions_raw: "Source: https://example.com/pancakes\n\nMix and fry.",
    tags: ["breakfast"],
    ingredients: [
      { name: "flour", amount: 2, unit_code: "cup", is_pantry_staple: false },
      { name: "salt", amount: 0, unit_code: "item", is_pantry_staple: true },
    ],
    steps: ["Mix everything.", "Fry in butter."],
    ...overrides,
  };
}

describe("draftToFormState", () => {
  it("maps scalar fields to their string form", () => {
    const form = draftToFormState(draft(), UNITS);
    expect(form.id).toBeNull();
    expect(form.name).toBe("Pancakes");
    expect(form.base_servings).toBe("4");
    expect(form.instructions_raw).toBe("Source: https://example.com/pancakes\n\nMix and fry.");
    expect(form.tags).toEqual(["breakfast"]);
  });

  it("maps ingredient rows with string amounts and fresh ids", () => {
    const form = draftToFormState(draft(), UNITS);
    expect(form.ingredients).toHaveLength(2);
    expect(form.ingredients[0]).toMatchObject({ name: "flour", amount: "2", unit_code: "cup", is_pantry_staple: false });
    expect(form.ingredients[1]).toMatchObject({ name: "salt", amount: "0", unit_code: "item", is_pantry_staple: true });
    expect(form.ingredients[0].id).toBeTruthy();
    expect(form.ingredients[0].id).not.toBe(form.ingredients[1].id);
  });

  it("maps steps to body rows and drops blank steps", () => {
    const form = draftToFormState(draft({ steps: ["Mix.", "   ", "Fry."] }), UNITS);
    expect(form.steps.map((step) => step.body)).toEqual(["Mix.", "Fry."]);
  });

  it("falls back to 'item' when a unit is not in the loaded units table", () => {
    const form = draftToFormState(
      draft({ ingredients: [{ name: "mystery", amount: 1, unit_code: "cup", is_pantry_staple: false }] }),
      [{ code: "item", label: "item" }],
    );
    expect(form.ingredients[0].unit_code).toBe("item");
  });

  it("keeps a known unit code untouched", () => {
    const form = draftToFormState(
      draft({ ingredients: [{ name: "sugar", amount: 3, unit_code: "tbsp", is_pantry_staple: false }] }),
      UNITS,
    );
    expect(form.ingredients[0].unit_code).toBe("tbsp");
  });

  it("guarantees at least one step row when the draft has no steps", () => {
    const form = draftToFormState(draft({ steps: [] }), UNITS);
    expect(form.steps).toHaveLength(1);
    expect(form.steps[0].body).toBe("");
  });
});
