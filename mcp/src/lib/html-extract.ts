import * as cheerio from "cheerio";

interface ExtractionResult {
  type: "json-ld" | "text";
  content: string;
  title: string;
}

/**
 * Extracts recipe content from HTML.
 * Priority: JSON-LD schema.org Recipe data, then text fallback.
 */
export function extractRecipeContent(html: string): ExtractionResult {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();

  // Tier 1: JSON-LD extraction
  const jsonLd = extractJsonLdRecipe($);
  if (jsonLd) {
    return {
      type: "json-ld",
      content: JSON.stringify(jsonLd, null, 2),
      title,
    };
  }

  // Tier 2: Text fallback
  const text = extractTextContent($);
  return {
    type: "text",
    content: text,
    title,
  };
}

function extractJsonLdRecipe($: cheerio.CheerioAPI): unknown | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const recipe = findRecipeInJsonLd(parsed);
      if (recipe) return recipe;
    } catch {
      // Invalid JSON, skip
    }
  }
  return null;
}

function findRecipeInJsonLd(data: unknown): unknown | null {
  if (!data || typeof data !== "object") return null;

  // Direct Recipe type
  if ("@type" in (data as Record<string, unknown>)) {
    const type = (data as Record<string, unknown>)["@type"];
    if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
      return data;
    }
  }

  // @graph array (common pattern)
  if ("@graph" in (data as Record<string, unknown>)) {
    const graph = (data as Record<string, unknown>)["@graph"];
    if (Array.isArray(graph)) {
      for (const item of graph) {
        const recipe = findRecipeInJsonLd(item);
        if (recipe) return recipe;
      }
    }
  }

  // Top-level array
  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  return null;
}

function extractTextContent($: cheerio.CheerioAPI): string {
  // Remove non-content elements
  $("script, style, nav, header, footer, aside, [role='navigation'], [role='banner']").remove();

  // Try to find main content area
  let contentEl = $("main").first();
  if (!contentEl.length) contentEl = $("article").first();
  if (!contentEl.length) contentEl = $("[role='main']").first();
  if (!contentEl.length) contentEl = $("body").first();

  // Get text, collapse whitespace
  const text = contentEl
    .text()
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Truncate to ~8000 chars to keep context manageable
  const maxLen = 8000;
  if (text.length > maxLen) {
    return text.slice(0, maxLen) + "\n\n[Content truncated at 8000 characters]";
  }

  return text;
}
