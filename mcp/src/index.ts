import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFetchRecipeUrl } from "./tools/fetch-recipe-url.js";
import { registerSaveRecipe } from "./tools/save-recipe.js";
import { registerExportRecipes } from "./tools/export-recipes.js";

const server = new McpServer({
  name: "meal-planner-mcp",
  version: "0.1.0",
});

registerFetchRecipeUrl(server);
registerSaveRecipe(server);
registerExportRecipes(server);

const transport = new StdioServerTransport();
await server.connect(transport);
