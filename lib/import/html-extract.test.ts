import { describe, expect, it } from "vitest";
import {
  extractJsonLdBlocks,
  extractRecipeContent,
  extractTitle,
  findRecipeInJsonLd,
  htmlToText,
} from "./html-extract";

const ldScript = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe("JSON-LD extraction", () => {
  it("finds a direct @type Recipe", () => {
    const result = extractRecipeContent(ldScript({ "@type": "Recipe", name: "A" }));
    expect(result.kind).toBe("json-ld");
    if (result.kind === "json-ld") expect(result.content).toContain('"name":"A"');
  });

  it("finds a Recipe inside @graph", () => {
    const html = ldScript({
      "@graph": [{ "@type": "WebPage" }, { "@type": "Recipe", name: "G" }],
    });
    const recipe = findRecipeInJsonLd(extractJsonLdBlocks(html)[0]);
    expect((recipe as { name?: string })?.name).toBe("G");
  });

  it("finds a Recipe in a top-level array", () => {
    const html = ldScript([{ "@type": "Thing" }, { "@type": "Recipe", name: "T" }]);
    const recipe = findRecipeInJsonLd(extractJsonLdBlocks(html)[0]);
    expect((recipe as { name?: string })?.name).toBe("T");
  });

  it("finds a Recipe when @type is an array", () => {
    const html = ldScript({ "@type": ["Thing", "Recipe"], name: "AR" });
    const recipe = findRecipeInJsonLd(extractJsonLdBlocks(html)[0]);
    expect((recipe as { name?: string })?.name).toBe("AR");
  });

  it("skips malformed JSON-LD blocks", () => {
    const html =
      `<script type="application/ld+json">{ not json }</script>` +
      ldScript({ "@type": "Recipe", name: "OK" });
    expect(extractJsonLdBlocks(html)).toHaveLength(1);
    expect(extractRecipeContent(html).kind).toBe("json-ld");
  });

  it("caps stringified JSON-LD at 15000 chars", () => {
    const big = { "@type": "Recipe", name: "Big", notes: "x".repeat(20000) };
    const result = extractRecipeContent(ldScript(big));
    if (result.kind === "json-ld") {
      expect(result.content.length).toBeLessThanOrEqual(15000);
    }
  });
});

describe("text fallback", () => {
  it("strips nav/script/style and returns readable main text", () => {
    const html =
      `<html><head><title>T</title></head><body>` +
      `<nav>Home About</nav>` +
      `<main><h1>Soup</h1><p>Boil water.</p></main>` +
      `<script>var x = 1</script></body></html>`;
    const result = extractRecipeContent(html);
    expect(result.kind).toBe("text");
    if (result.kind === "text") {
      expect(result.content).toContain("Boil water");
      expect(result.content).not.toContain("Home About");
      expect(result.content).not.toContain("var x");
    }
  });

  it("decodes HTML entities", () => {
    expect(
      htmlToText("<p>salt &amp; pepper &lt;3 &quot;yes&quot; it&#39;s&nbsp;good</p>"),
    ).toBe("salt & pepper <3 \"yes\" it's good");
  });

  it("truncates to 8000 chars", () => {
    expect(htmlToText(`<p>${"a ".repeat(9000)}</p>`).length).toBe(8000);
  });

  it("extracts and cleans the title", () => {
    expect(extractTitle("<title> Best  Pancakes &amp; Syrup </title>")).toBe(
      "Best Pancakes & Syrup",
    );
  });

  it("returns null when there is no title", () => {
    expect(extractTitle("<html></html>")).toBeNull();
  });
});
