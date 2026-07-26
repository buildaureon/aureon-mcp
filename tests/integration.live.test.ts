/**
 * Live integration tests — MCP tools against the real AUREON API.
 * Skips unless AUREON_MCP_LIVE_TEST=1.
 *
 * Auth (pick one):
 *   AUREON_API_KEY=issued developer key   (preferred — wallet identity)
 *   AUREON_AUTH_TOKEN=Bearer…
 *   AUREON_WALLET_PRIVATE_KEY=0x…         (signs nonce → Bearer for the suite)
 *
 * Optional: AUREON_API_URL (default https://api.aureonlabs.network)
 * Optional: AUREON_E2E_INVITE_CODE
 *
 * Note: product-gate bootstrap keys alone cannot identify a wallet — those
 * tests skip unless a wallet Bearer or issued key path succeeds.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createAureonClient,
  createSessionTokenProvider,
} from "@buildaureon/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { registerTools } from "../src/tools/index.js";

const LIVE = process.env.AUREON_MCP_LIVE_TEST === "1";
const API_URL = process.env.AUREON_API_URL || "https://api.aureonlabs.network";
const API_KEY = process.env.AUREON_API_KEY || "";
let AUTH_TOKEN = process.env.AUREON_AUTH_TOKEN || "";
const WALLET_PK = process.env.AUREON_WALLET_PRIVATE_KEY?.trim() || "";

let identityReady = Boolean(AUTH_TOKEN);

async function ensureWalletSession(): Promise<void> {
  if (AUTH_TOKEN || !WALLET_PK) return;
  if (!/^0x[0-9a-fA-F]{64}$/.test(WALLET_PK)) return;
  const account = privateKeyToAccount(WALLET_PK as `0x${string}`);
  const sdk = createAureonClient({
    baseUrl: API_URL,
    apiKey: API_KEY || undefined,
  });
  const { message } = await sdk.getAuthNonce(account.address);
  const signature = await account.signMessage({ message });
  const invite = process.env.AUREON_E2E_INVITE_CODE?.trim();
  const login = await sdk.verifyWallet({
    address: account.address,
    message,
    signature,
    inviteCode: invite || undefined,
  });
  AUTH_TOKEN = login.token;
  identityReady = true;
}

async function createLiveClient() {
  await ensureWalletSession();
  const server = new McpServer({ name: "live-test", version: "0.0.0" });
  const session = createSessionTokenProvider(AUTH_TOKEN || null);
  const sdk = createAureonClient({
    baseUrl: API_URL,
    apiKey: API_KEY || undefined,
    getAccessToken: session.getAccessToken,
  });
  registerTools(server, sdk, session);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "live-test-client", version: "0.0.0" });
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

function textContent(result: unknown): string {
  const r = result as { content?: unknown };
  const content = r.content as Array<{ type: string; text?: string }> | undefined;
  const block = content?.[0];
  return block && "text" in block && block.text ? block.text : "";
}

function assertOk(result: unknown): void {
  const r = result as { isError?: boolean };
  assert.equal(r.isError, undefined, textContent(result));
}

async function authAvailable(): Promise<boolean> {
  if (!LIVE) return false;
  if (identityReady || AUTH_TOKEN) return true;
  if (WALLET_PK) {
    try {
      await ensureWalletSession();
      return identityReady;
    } catch {
      return false;
    }
  }
  // Issued key alone: probe aureon_me once
  if (!API_KEY) return false;
  try {
    const client = await createLiveClient();
    const result = await client.callTool({ name: "aureon_me", arguments: {} });
    if (!(result as { isError?: boolean }).isError) {
      identityReady = true;
      return true;
    }
  } catch {
    /* bootstrap key without wallet identity */
  }
  return false;
}

test("live: bootstrap auth", { skip: !LIVE }, async () => {
  await authAvailable();
  assert.ok(true);
});

test("live: aureon_ping", { skip: !LIVE }, async () => {
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_ping", arguments: {} });
  assertOk(result);
  const body = JSON.parse(textContent(result));
  assert.equal(body.ok, true);
  assert.ok(body.service);
});

test("live: aureon_get_overview", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_get_overview", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_get_portfolio", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_get_portfolio", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_list_objectives", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_list_objectives", arguments: {} });
  assertOk(result);
  const objectives = JSON.parse(textContent(result));
  assert.ok(Array.isArray(objectives));
});

test("live: aureon_get_health", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_get_health", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_list_timeline", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_list_timeline", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_list_market_presets", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_list_market_presets", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_get_vault", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_get_vault", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_get_vault_status", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_get_vault_status", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_list_executions", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_list_executions", arguments: {} });
  assertOk(result);
  JSON.parse(textContent(result));
});

test("live: aureon_me", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const result = await client.callTool({ name: "aureon_me", arguments: {} });
  assertOk(result);
  const me = JSON.parse(textContent(result));
  assert.ok(me.walletAddress || me.address);
});

test("live: objective-scoped tools", { skip: !LIVE }, async (t) => {
  if (!(await authAvailable())) return t.skip("needs issued key or wallet Bearer");
  const client = await createLiveClient();
  const listResult = await client.callTool({ name: "aureon_list_objectives", arguments: {} });
  assertOk(listResult);
  const objectives = JSON.parse(textContent(listResult));
  if (objectives.length === 0) {
    console.log("  (no objectives — skipping get_objective / restore_plan)");
    return;
  }
  const id = objectives[0].id as string;

  const objResult = await client.callTool({
    name: "aureon_get_objective",
    arguments: { objectiveId: id },
  });
  assertOk(objResult);

  const healthResult = await client.callTool({
    name: "aureon_get_health",
    arguments: { objectiveId: id },
  });
  assertOk(healthResult);

  const restoreResult = await client.callTool({
    name: "aureon_get_restore_plan",
    arguments: { objectiveId: id },
  });
  assert.ok(restoreResult.content);
});
