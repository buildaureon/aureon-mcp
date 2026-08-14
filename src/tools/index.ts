import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient, SessionTokenProvider } from "@buildaureon/sdk";
import { registerReadTools } from "./read.js";
import { registerCompassTools } from "./compass.js";
import { registerVaultTools } from "./vault.js";
import { registerAuthTools } from "./auth.js";
import { registerObjectiveTools } from "./objectives.js";
import { registerPortfolioTools } from "./portfolio.js";
import { registerMarketTools } from "./market.js";
import { registerDeveloperTools } from "./developer.js";
import { registerRegistryTools } from "./registry.js";
import { SDK_TOOL_NAMES, TOOL_COUNT } from "./catalog.js";

export { SDK_TOOL_NAMES, TOOL_COUNT };

/** All AureonClient SDK methods exposed as MCP tools. */
export function registerTools(
  server: McpServer,
  client: AureonClient,
  session: SessionTokenProvider
) {
  registerReadTools(server, client);
  registerCompassTools(server, client);
  registerVaultTools(server, client);
  registerAuthTools(server, client, session);
  registerObjectiveTools(server, client);
  registerPortfolioTools(server, client);
  registerMarketTools(server, client);
  registerDeveloperTools(server, client);
  registerRegistryTools(server, client);
}
