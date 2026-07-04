// Ported from mcp/src/lib/html-extract.ts (2026-07). mcp/ stays a separate consumer.
//
// Cheerio-free: the mcp version depends on cheerio, which the app does not (and
// must not, per the zero-new-deps rule). The JSON-LD recipe walker is ported
// unchanged; the DOM traversal is reimplemented with regexes. Extraction is
// best-effort — JSON-LD is the reliable path; the text fallback is a heuristic.

const JSON_LD_RE =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Parse every application/ld+json block; skip blocks that fail to parse.
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(JSON_LD_RE)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Invalid JSON, skip
    }
  }
  return blocks;
}

// Ported UNCHANGED from mcp: direct @type "Recipe", @type arrays containing
// "Recipe", @graph arrays, top-level arrays, recursive.
export function findRecipeInJsonLd(data: unknown): object | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;

  if ("@type" in record) {
    const type = record["@type"];
    if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
      return record;
    }
  }

  if ("@graph" in record) {
    const graph = record["@graph"];
    if (Array.isArray(graph)) {
      for (const item of graph) {
        const recipe = findRecipeInJsonLd(item);
        if (recipe) return recipe;
      }
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  return null;
}

const ENTITIES: [RegExp, string][] = [
  [/&nbsp;/g, " "],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, "&"], // last, so we never re-expand an already-decoded entity
];

function decodeEntities(input: string): string {
  let out = input;
  for (const [re, replacement] of ENTITIES) out = out.replace(re, replacement);
  return out;
}

// Prefer the main content region if we can find one; else the whole doc.
function sliceMainRegion(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return main[1];
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) return article[1];
  const roleMain = html.match(
    /<(\w+)\b[^>]*\brole\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/\1>/i,
  );
  if (roleMain) return roleMain[2];
  return html;
}

export function htmlToText(html: string): string {
  // Remove non-content blocks (script/style/nav/header/footer/aside).
  let stripped = html.replace(
    /<(script|style|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  stripped = sliceMainRegion(stripped);
  // Strip remaining tags, decode entities, collapse whitespace.
  const text = decodeEntities(stripped.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 8000 ? text.slice(0, 8000) : text;
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : null;
}

export type RecipeExtraction =
  | { kind: "json-ld"; content: string }
  | { kind: "text"; content: string; title: string | null };

export function extractRecipeContent(html: string): RecipeExtraction {
  for (const block of extractJsonLdBlocks(html)) {
    const recipe = findRecipeInJsonLd(block);
    if (recipe) {
      const json = JSON.stringify(recipe);
      return {
        kind: "json-ld",
        content: json.length > 15000 ? json.slice(0, 15000) : json,
      };
    }
  }
  return { kind: "text", content: htmlToText(html), title: extractTitle(html) };
}
