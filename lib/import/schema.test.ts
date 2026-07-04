import { describe, expect, it } from "vitest";
import { DEFAULT_UNITS } from "../constants";
import {
  DRAFT_JSON_SCHEMA,
  importRequestSchema,
  recipeDraftSchema,
  VALID_UNIT_CODES,
} from "./schema";

describe("import schema", () => {
  it("VALID_UNIT_CODES equals the DEFAULT_UNITS codes", () => {
    expect([...VALID_UNIT_CODES]).toEqual(DEFAULT_UNITS.map((u) => u.code));
  });

  it("accepts a valid draft", () => {
    const draft = {
      name: "Pancakes",
      base_servings: 4,
      instructions_raw: "Mix. Fry.",
      tags: ["breakfast"],
      ingredients: [
        { name: "flour", amount: 2, unit_code: "cup", is_pantry_staple: true },
      ],
      steps: ["Mix everything", "Fry in butter"],
    };
    expect(recipeDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("rejects a draft with zero ingredients", () => {
    const draft = {
      name: "X",
      base_servings: 4,
      instructions_raw: "",
      tags: [],
      ingredients: [],
      steps: [],
    };
    expect(recipeDraftSchema.safeParse(draft).success).toBe(false);
  });

  describe("DRAFT_JSON_SCHEMA structurally mirrors the draft", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draftObj = DRAFT_JSON_SCHEMA.anyOf[0] as any;

    it("constrains unit_code to the unit enum", () => {
      expect(draftObj.properties.ingredients.items.properties.unit_code.enum).toEqual(
        [...VALID_UNIT_CODES],
      );
    });

    it("sets additionalProperties:false on every object", () => {
      expect(draftObj.additionalProperties).toBe(false);
      expect(draftObj.properties.ingredients.items.additionalProperties).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((DRAFT_JSON_SCHEMA.anyOf[1] as any).additionalProperties).toBe(false);
    });

    it("requires the five draft fields and omits instructions_raw", () => {
      expect(draftObj.required).toEqual([
        "name",
        "base_servings",
        "tags",
        "ingredients",
        "steps",
      ]);
      expect(draftObj.properties.instructions_raw).toBeUndefined();
    });

    it("carries no numeric constraints (unsupported by structured output)", () => {
      expect(draftObj.properties.base_servings.minimum).toBeUndefined();
      expect(
        draftObj.properties.ingredients.items.properties.amount.minimum,
      ).toBeUndefined();
    });
  });

  describe("importRequestSchema", () => {
    it("accepts text only", () => {
      expect(importRequestSchema.safeParse({ text: "2 cups flour" }).success).toBe(
        true,
      );
    });

    it("accepts url only", () => {
      expect(
        importRequestSchema.safeParse({ url: "https://example.com/r" }).success,
      ).toBe(true);
    });

    it("rejects both text and url", () => {
      expect(
        importRequestSchema.safeParse({ text: "x", url: "https://e.com" }).success,
      ).toBe(false);
    });

    it("rejects neither", () => {
      expect(importRequestSchema.safeParse({}).success).toBe(false);
    });

    it("defaults tags to []", () => {
      expect(importRequestSchema.parse({ text: "x" }).tags).toEqual([]);
    });

    it("flags over-long text with a too_big issue on the text path", () => {
      const result = importRequestSchema.safeParse({ text: "a".repeat(25001) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.path[0] === "text" && issue.code === "too_big",
          ),
        ).toBe(true);
      }
    });

    it("rejects a non-http url", () => {
      expect(
        importRequestSchema.safeParse({ url: "ftp://example.com/x" }).success,
      ).toBe(false);
    });
  });
});
