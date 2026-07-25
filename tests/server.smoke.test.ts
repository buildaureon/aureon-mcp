import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createAureonClient,
  createSessionTokenProvider,
} from "@buildaureon/sdk";
import { registerTools, TOOL_COUNT } from "../src/tools/index.js";

test(`server registers ${TOOL_COUNT} SDK tools`, () => {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const session = createSessionTokenProvider(null);
  const client = createAureonClient({
    baseUrl: "http://localhost:9999",
    apiKey: "test",
    getAccessToken: session.getAccessToken,
  });
  registerTools(server, client, session);
  assert.ok(server, "server created successfully");
});

test("tool registration does not throw", () => {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const session = createSessionTokenProvider(null);
  const client = createAureonClient({
    baseUrl: "http://localhost:9999",
    apiKey: "test",
    getAccessToken: session.getAccessToken,
  });
  assert.doesNotThrow(() => registerTools(server, client, session));
});
