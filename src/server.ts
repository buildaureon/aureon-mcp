import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createClient } from "./client.js";
import { registerTools } from "./tools/index.js";

export async function startServer() {
  const config = loadConfig();
  const { client, session } = createClient(config);

  const server = new McpServer({
    name: "aureon",
    version: "0.1.1",
  });

  registerTools(server, client, session);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
