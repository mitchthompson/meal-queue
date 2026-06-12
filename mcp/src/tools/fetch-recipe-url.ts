import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { extractRecipeContent } from "../lib/html-extract.js";
import { COMMON_PANTRY_STAPLES } from "../lib/pantry-staples.js";
import { VALID_UNIT_CODES } from "../lib/recipe-schema.js";

const inputSchema = {
  url: z.string().url().describe("URL of the recipe page to fetch"),
};

export function registerFetchRecipeUrl(server: McpServer): void {
  server.tool(
    "fetch-recipe-url",
    "Fetches a recipe web page and extracts its content (JSON-LD or text). " +
      "Returns raw content for you to parse into structured recipe data. " +
      "After parsing, use save-recipe to persist it.",
    inputSchema,
    async ({ url }) => {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });

        if (!response.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const html = await response.text();
        const result = extractRecipeContent(html);

        const header =
          result.type === "json-ld"
            ? `Found structured JSON-LD Recipe data from: ${result.title}`
            : `No JSON-LD found. Extracted text content from: ${result.title}`;

        const reference = [
          "",
          "---",
          "REFERENCE FOR PARSING:",
          `Valid unit_code values: ${VALID_UNIT_CODES.join(", ")}`,
          `Common pantry staples (mark is_pantry_staple=true): ${COMMON_PANTRY_STAPLES.join(", ")}`,
          "",
          "Parse this into the save-recipe format with: name, base_servings, instructions_raw, tags[], ingredients[{name, amount, unit_code, is_pantry_staple}], steps[]",
        ].join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `${header}\n\nSource URL: ${url}\n\n${result.content}${reference}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error fetching URL: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
