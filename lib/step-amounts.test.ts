import { describe, expect, it } from "vitest";
import { IMPORT_MODEL } from "./import/anthropic";
import {
  BACKFILL_JSON_SCHEMA,
  BACKFILL_MODEL,
  BACKFILL_SYSTEM_PROMPT,
  auditInsertions,
  buildApplySql,
  buildBackfillUserContent,
  buildCheckSql,
  checkInsertOnly,
  parseBackfillResponse,
  parseQuantities,
  tokenize,
} from "./step-amounts";

const STEP_ID = "00000000-0000-0000-0000-000000000001";

describe("tokenize", () => {
  it("splits words from punctuation and ignores whitespace", () => {
    expect(tokenize("Add 1/2 cup.").map((t) => t.text)).toEqual(["Add", "1", "/", "2", "cup", "."]);
    expect(tokenize("Add 1/2 cup.")[4]).toEqual({ text: "cup", start: 8, end: 11 });
    expect(tokenize("  skin-side \n down ").map((t) => t.text)).toEqual(["skin", "-", "side", "down"]);
  });

  it("keeps accented words and number-fraction runs whole", () => {
    expect(tokenize("Sauté the jalapeño").map((t) => t.text)).toEqual(["Sauté", "the", "jalapeño"]);
    expect(tokenize("Sauté it").map((t) => t.text)).toEqual(["Sauté", "it"]);
    expect(tokenize("350°F, 1½ cups").map((t) => t.text)).toEqual(["350", "°", "F", ",", "1½", "cups"]);
  });
});

describe("checkInsertOnly", () => {
  it("accepts an amount inserted before the ingredient", () => {
    const result = checkInsertOnly("Season with pepper.", "Season with 2 tsp pepper.");
    expect(result).toMatchObject({ ok: true, changed: true, final: "Season with 2 tsp pepper." });
    if (result.ok) expect(result.insertions).toEqual([{ after: 1, text: "2 tsp" }]);
  });

  it("accepts a parenthetical before trailing punctuation", () => {
    const result = checkInsertOnly("Add the garlic.", "Add the garlic (4 cloves).");
    expect(result).toMatchObject({ ok: true, final: "Add the garlic (4 cloves)." });
    if (result.ok) expect(result.insertions).toEqual([{ after: 2, text: "(4 cloves)" }]);
  });

  it("accepts insertions at the very start and end", () => {
    const result = checkInsertOnly("eggs, beaten", "3 eggs, beaten (about 1 cup)");
    expect(result).toMatchObject({ ok: true, final: "3 eggs, beaten (about 1 cup)" });
    if (result.ok) {
      expect(result.insertions).toEqual([
        { after: -1, text: "3" },
        { after: 2, text: "(about 1 cup)" },
      ]);
    }
  });

  it("reports an identical proposal as unchanged", () => {
    const text = "Roast 15 minutes, rest 5, then serve.";
    expect(checkInsertOnly(text, text)).toMatchObject({ ok: true, changed: false, final: text });
  });

  it("rejects a changed word", () => {
    const result = checkInsertOnly("Add salt.", "Add 1 tsp salts.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('"salt"');
  });

  it("rejects a dropped word", () => {
    expect(checkInsertOnly("Stir well and serve.", "Stir and serve.").ok).toBe(false);
  });

  it("rejects reordered words", () => {
    expect(checkInsertOnly("Add salt and pepper.", "Add pepper and salt.").ok).toBe(false);
  });

  it("rejects changed or dropped punctuation", () => {
    expect(checkInsertOnly("Add salt, then pepper.", "Add salt; then pepper.").ok).toBe(false);
    expect(checkInsertOnly("Simmer 3–4 minutes.", "Simmer 3-4 minutes.").ok).toBe(false);
    expect(checkInsertOnly("Season to taste.", "Season to taste").ok).toBe(false);
  });

  it("rejects a capitalization change", () => {
    expect(checkInsertOnly("add salt", "Add 1 tsp salt").ok).toBe(false);
  });

  it("keeps the original's whitespace wherever nothing was inserted", () => {
    expect(checkInsertOnly("Mix well.\nServe hot.", "Mix well. Serve hot with 1 cup rice.")).toMatchObject({
      ok: true,
      final: "Mix well.\nServe hot with 1 cup rice.",
    });
    expect(checkInsertOnly("Add  salt", "Add salt (1 tsp)")).toMatchObject({ ok: true, final: "Add  salt (1 tsp)" });
  });

  it("rejects an empty original and an empty proposal", () => {
    expect(checkInsertOnly("   ", "Add 1 tsp salt").ok).toBe(false);
    expect(checkInsertOnly("Add salt", "").ok).toBe(false);
  });

  it("attributes an insertion to the first of repeated words", () => {
    const result = checkInsertOnly(
      "Melt half the butter, then add the rest of the butter.",
      "Melt half the butter (2 tbsp), then add the rest of the butter.",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.insertions).toEqual([{ after: 3, text: "(2 tbsp)" }]);
  });

  it("returns segments that join to the final text and mark only insertions", () => {
    const cases: Array<[string, string]> = [
      ["Season with pepper.", "Season with 2 tsp pepper."],
      ["eggs, beaten", "  3 eggs, beaten (about 1 cup)  "],
      ["Mix well.\nServe hot.", "Mix well. Serve hot with 1 cup rice."],
      ["  Add salt  ", "Add 1 tsp salt"],
    ];
    for (const [original, proposal] of cases) {
      const result = checkInsertOnly(original, proposal);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.segments.map((s) => s.text).join("")).toBe(result.final);
      expect(result.segments.filter((s) => s.inserted).map((s) => s.text)).toEqual(
        result.insertions.map((i) => i.text),
      );
      expect(result.segments.every((s) => s.text.length > 0)).toBe(true);
    }
  });
});

describe("auditInsertions", () => {
  it("flags inserted words that are not amounts, units, or ingredient words", () => {
    const result = checkInsertOnly(
      "Warm cherry tomatoes until they burst.",
      "Warm 1 lb cherry tomatoes until they do not burst.",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(auditInsertions(result.insertions, [{ name: "cherry tomatoes", amount: 1 }])).toEqual([
      'Unexpected word "do" in "do not"',
      'Unexpected word "not" in "do not"',
    ]);
  });

  it("accepts ingredient words, plurals, units, and glue words", () => {
    const ingredients = [
      { name: "kosher salt", amount: 1 },
      { name: "lemon", amount: 2 },
    ];
    expect(auditInsertions([{ after: 0, text: "1 tsp kosher" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "(2 lemons)" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "2 tablespoons of the" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "1tsp" }], ingredients)).toEqual(['Unexpected word "1tsp" in "1tsp"']);
  });

  it("flags an amount that is not in the ingredient list", () => {
    expect(auditInsertions([{ after: 0, text: "3 cups" }], [{ name: "broth", amount: 1.5 }])).toEqual([
      'Amount 3 in "3 cups" is not in the ingredient list',
    ]);
  });

  it("matches cookbook fractions and numbers inside ingredient names", () => {
    const ingredients = [
      { name: "broth", amount: 1.5 },
      { name: "black beans (15-oz can)", amount: 1 },
      { name: "sugar", amount: 0.333 },
    ];
    expect(auditInsertions([{ after: 0, text: "1 1/2 cups" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "(15-oz can)" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "1/3 cup" }], ingredients)).toEqual([]);
  });
});

describe("parseQuantities", () => {
  it("reads mixed numbers, fractions, decimals, and vulgar fractions", () => {
    expect(parseQuantities("1 1/2 cups")).toEqual([1.5]);
    expect(parseQuantities("1/2 tsp")).toEqual([0.5]);
    expect(parseQuantities("½ tsp and 1½ cups and 2.25 lb")).toEqual([0.5, 1.5, 2.25]);
    expect(parseQuantities("(4 cloves)")).toEqual([4]);
  });
});

describe("parseBackfillResponse", () => {
  it("returns step bodies keyed by step number", () => {
    const parsed = parseBackfillResponse(
      { steps: [{ step_number: 1, body: "a" }, { step_number: 2, body: "b" }] },
      [1, 2],
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.bodies.get(2)).toBe("b");
  });

  it("rejects missing, duplicate, malformed, or non-integer steps", () => {
    expect(parseBackfillResponse({ steps: [{ step_number: 1, body: "a" }] }, [1, 2]).ok).toBe(false);
    expect(
      parseBackfillResponse({ steps: [{ step_number: 1, body: "a" }, { step_number: 1, body: "b" }] }, [1]).ok,
    ).toBe(false);
    expect(parseBackfillResponse({ steps: [{ step_number: 1, body: 5 }] }, [1]).ok).toBe(false);
    expect(parseBackfillResponse({ steps: [{ step_number: 1.5, body: "a" }] }, [1]).ok).toBe(false);
    expect(parseBackfillResponse({ steps: [null] }, [1]).ok).toBe(false);
    expect(parseBackfillResponse(null, [1]).ok).toBe(false);
  });
});

describe("backfill prompt", () => {
  it("uses the import model", () => {
    expect(BACKFILL_MODEL).toBe(IMPORT_MODEL);
  });

  it("states the insert-only, to-taste, and no-guessing rules", () => {
    expect(BACKFILL_SYSTEM_PROMPT).toContain("You may only INSERT text");
    expect(BACKFILL_SYSTEM_PROMPT).toContain('listed as "to taste"');
    expect(BACKFILL_SYSTEM_PROMPT).toContain("never guess a portion");
  });

  it("builds the user content with amounts and numbered steps", () => {
    const content = buildBackfillUserContent({
      name: "Soup",
      base_servings: 4,
      ingredients: [
        { name: "salt", amountText: "to taste" },
        { name: "broth", amountText: "1.5 cup" },
      ],
      steps: [{ step_number: 1, body: "Add broth." }],
    });
    expect(content).toBe(
      "RECIPE: Soup (serves 4)\n\nINGREDIENTS:\n- salt: to taste\n- broth: 1.5 cup\n\nSTEPS:\n1. Add broth.",
    );
  });

  it("uses only structured-output keywords Haiku accepts", () => {
    expect(BACKFILL_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(BACKFILL_JSON_SCHEMA.properties.steps.items.additionalProperties).toBe(false);
    const text = JSON.stringify(BACKFILL_JSON_SCHEMA);
    for (const keyword of ["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum"]) {
      expect(text).not.toContain(keyword);
    }
  });
});

describe("SQL generation", () => {
  const rows = [
    { step_id: STEP_ID, old_body: "Add the cook's salt \\ now.", new_body: "Add the cook's salt (1 tsp) \\ now." },
  ];

  it("doubles single quotes and keeps backslashes literal", () => {
    const sql = buildApplySql(rows, "COMMIT", "apply");
    expect(sql).toContain("SET standard_conforming_strings = on;");
    expect(sql).toContain("cook''s salt");
    expect(sql).toContain("\\\\ now.");
  });

  it("ends with COMMIT or ROLLBACK as asked", () => {
    expect(buildApplySql(rows, "COMMIT", "apply").trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(buildApplySql(rows, "ROLLBACK", "rehearsal").trimEnd().endsWith("ROLLBACK;")).toBe(true);
  });

  it("refuses empty, duplicate, or no-op payloads", () => {
    expect(() => buildApplySql([], "COMMIT", "apply")).toThrow();
    expect(() => buildApplySql([{ step_id: STEP_ID, old_body: "x", new_body: "x" }], "COMMIT", "apply")).toThrow();
    expect(() =>
      buildApplySql(
        [
          { step_id: STEP_ID, old_body: "x", new_body: "y" },
          { step_id: STEP_ID, old_body: "x", new_body: "z" },
        ],
        "COMMIT",
        "apply",
      ),
    ).toThrow();
  });

  it("builds a read-only check query over the same payload", () => {
    const sql = buildCheckSql(rows);
    expect(sql).toContain("untouched_steps_md5");
    expect(sql).toContain("plan_versions_md5");
    expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE|BEGIN|COMMIT)\b/);
  });
});
