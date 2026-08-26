import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createAureonClient,
  createSessionTokenProvider,
} from "@buildaureon/sdk";
import { registerTools, SDK_TOOL_NAMES, TOOL_COUNT } from "../src/tools/index.js";

async function createTestSetup() {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const session = createSessionTokenProvider(null);
  const client = createAureonClient({
    baseUrl: "http://localhost:9999",
    apiKey: "test",
    getAccessToken: session.getAccessToken,
  });
  registerTools(server, client, session);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "0.0.0" });

  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);

  return { mcpClient, server };
}
test(`lists all ${TOOL_COUNT} SDK tools`, async () => {
  const { mcpClient } = await createTestSetup();
  const result = await mcpClient.listTools();
  assert.equal(result.tools.length, TOOL_COUNT);

  const names = result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...SDK_TOOL_NAMES].sort());
});

test("write tools are registered", async () => {
  const { mcpClient } = await createTestSetup();
  const result = await mcpClient.listTools();
  const names = new Set(result.tools.map((t) => t.name));
  for (const tool of [
    "aureon_create_objective",
    "aureon_apply_financial_intent",
    "aureon_get_objective_portfolio_flow",
    "aureon_run_execution",
    "aureon_set_portfolio",
    "aureon_prepare_vault_deposit",
    "aureon_apply_market_event",
    "aureon_get_allocation_vs_target",
    "aureon_create_api_key",
  ]) {
    assert.ok(names.has(tool), `missing ${tool}`);
  }
});

test("aureon_ping returns error for unreachable server", async () => {
  const { mcpClient } = await createTestSetup();
  const result = await mcpClient.callTool({ name: "aureon_ping", arguments: {} });
  assert.ok(result.isError, "should be an error since the API is unreachable");
  assert.ok(result.content);
});
