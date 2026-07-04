import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserContent } from "./prompt";
import { COMMON_PANTRY_STAPLES } from "./pantry-staples";
import { VALID_UNIT_CODES } from "./schema";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(["chicken", "under-30-min"]);

  it("lists all 13 unit codes with meanings", () => {
    for (const code of VALID_UNIT_CODES) {
      expect(prompt).toContain(`${code} (`);
    }
  });

  it("includes the pantry staples list", () => {
    expect(prompt).toContain("pantry staples");
    expect(prompt).toContain(COMMON_PANTRY_STAPLES[0]); // "salt"
    expect(prompt).toContain("olive oil");
  });

  it("injects the allowed tags verbatim", () => {
    expect(prompt).toContain("chicken, under-30-min");
  });

  it("states the range upper-bound rule", () => {
    expect(prompt).toContain("upper bound");
    expect(prompt).toContain("2-3 tbsp");
  });

  it("handles an empty tag list", () => {
    const empty = buildSystemPrompt([]);
    expect(empty).toContain("no tags");
    expect(empty).toContain("[]");
  });
});

describe("buildUserContent", () => {
  it("labels a JSON-LD payload", () => {
    expect(buildUserContent("json-ld", "{...}")).toContain("schema.org JSON-LD");
  });

  it("labels pasted content", () => {
    expect(buildUserContent("paste", "recipe text")).toContain("pasted by the user");
  });

  it("includes the title for a text payload", () => {
    expect(buildUserContent("text", "body", "My Recipe")).toContain("My Recipe");
  });
});
