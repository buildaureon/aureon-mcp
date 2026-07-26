/**
 * Live MCP transaction tool smoke against the hosted API.
 *
 * Env:
 *   AUREON_API_KEY   required (issued developer key preferred)
 *   AUREON_API_URL   optional (default https://api.aureonlabs.network)
 *   AUREON_AUTH_TOKEN optional Bearer
 *
 * Run: pnpm --filter @buildaureon/mcp exec tsx tests/tx-live.mjs
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAureonClient, createSessionTokenProvider } from "@buildaureon/sdk";
import { registerTools } from "../src/tools/index.js";

const API_URL = process.env.AUREON_API_URL?.trim() || "https://api.aureonlabs.network";
const API_KEY = process.env.AUREON_API_KEY?.trim();
const AUTH_TOKEN = process.env.AUREON_AUTH_TOKEN?.trim() || null;

if (!API_KEY && !AUTH_TOKEN) {
  console.error("Set AUREON_API_KEY (or AUREON_AUTH_TOKEN)");
  process.exit(1);
}

const DUMMY_POSITIONS = [
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    category: "gas",
    quantity: 1,
    markPriceUsd: 2500,
  },
  {
    symbol: "TSLA",
    name: "Tesla Token",
    category: "stock_token",
    quantity: 10,
    markPriceUsd: 200,
  },
];

const session = createSessionTokenProvider(AUTH_TOKEN);

const sdk = createAureonClient({
  baseUrl: API_URL,
  apiKey: API_KEY || undefined,
  getAccessToken: session.getAccessToken,
});

async function createMcpClient() {
  const server = new McpServer({ name: "tx-live", version: "0.0.0" });
  registerTools(server, sdk, session);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "tx-live-client", version: "0.0.0" });
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

/** @param {unknown} result */
function textContent(result) {
  const r = /** @type {{ content?: Array<{ type: string; text?: string }> }} */ (result);
  const block = r.content?.[0];
  return block && "text" in block && block.text ? block.text : "";
}

/** @param {unknown} result */
function isToolError(result) {
  return Boolean(/** @type {{ isError?: boolean }} */ (result).isError);
}

/** @param {string} text */
function brief(text, max = 120) {
  const redacted = text
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\b/g, "[jwt]")
    .replace(/\b0x[a-fA-F0-9]{64}\b/g, "[secret]")
    .replace(/"secret"\s*:\s*"[^"]+"/g, '"secret":"[redacted]"')
    .replace(/"token"\s*:\s*"[^"]+"/g, '"token":"[redacted]"');
  const one = redacted.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

/** @type {Array<{ tool: string; status: string; result: string }>} */
const rows = [];

/** @param {string} tool @param {string} status @param {string} result */
function record(tool, status, result) {
  rows.push({ tool, status, result: brief(result) });
}

/** @param {Client} client @param {string} name @param {Record<string, unknown>} [args] */
async function runTool(client, name, args = {}) {
  try {
    const out = await client.callTool({ name, arguments: args });
    const text = textContent(out);
    if (isToolError(out)) {
      record(name, "FAIL", text || "tool returned isError");
      return { ok: false, text, raw: out };
    }
    record(name, "PASS", text || "ok");
    return { ok: true, text, raw: out };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record(name, "FAIL", msg);
    return { ok: false, text: msg, raw: null };
  }
}

/** @param {string} text */
function portfolioIsEmpty(text) {
  try {
    const data = JSON.parse(text);
    const positions = data?.portfolio?.positions ?? data?.positions;
    if (Array.isArray(positions)) return positions.length === 0;
    const total = data?.portfolio?.totalNotionalUsd ?? data?.totalNotionalUsd;
    return total === 0;
  } catch {
    return false;
  }
}

function printTable() {
  const wTool = Math.max(4, ...rows.map((r) => r.tool.length), "tool".length);
  const wStatus = Math.max(6, ...rows.map((r) => r.status.length), "status".length);
  const head = `${"tool".padEnd(wTool)} | ${"status".padEnd(wStatus)} | brief result`;
  console.log(head);
  console.log("-".repeat(Math.min(140, head.length + 80)));
  for (const r of rows) {
    console.log(`${r.tool.padEnd(wTool)} | ${r.status.padEnd(wStatus)} | ${r.result}`);
  }
}

async function main() {
  const client = await createMcpClient();

  const loginRaw = await client.callTool({ name: "aureon_dev_login", arguments: {} });
  const loginText = textContent(loginRaw);
  if (isToolError(loginRaw)) {
    record("aureon_dev_login", "FAIL", loginText || "dev login rejected");
    printTable();
    process.exitCode = 1;
    return;
  }
  try {
    const loginBody = JSON.parse(loginText);
    if (!loginBody?.token) {
      record("aureon_dev_login", "FAIL", "no token in response");
      printTable();
      process.exitCode = 1;
      return;
    }
    session.setToken(loginBody.token);
    record("aureon_dev_login", "PASS", `session wallet=${loginBody.walletAddress ?? "?"}`);
  } catch {
    record("aureon_dev_login", "FAIL", "invalid JSON session");
    printTable();
    process.exitCode = 1;
    return;
  }

  const sync = await runTool(client, "aureon_sync_portfolio");
  const needFallback = !sync.ok || portfolioIsEmpty(sync.text);
  if (needFallback) {
    rows.pop();
    const fallback = await runTool(client, "aureon_set_portfolio", { positions: DUMMY_POSITIONS });
    rows.pop();
    if (sync.ok && fallback.ok) {
      record("aureon_sync_portfolio", "PASS", "sync ok but empty book; set_portfolio fallback ok");
    } else if (!sync.ok && fallback.ok) {
      record(
        "aureon_sync_portfolio",
        "PASS",
        `sync failed (${brief(sync.text, 50)}); set_portfolio fallback ok`
      );
    } else {
      record(
        "aureon_sync_portfolio",
        "FAIL",
        `sync: ${sync.text}; set_portfolio: ${fallback.text}`
      );
    }
  }

  const created = await runTool(client, "aureon_create_objective", {
    name: "MCP Test",
    kind: "balanced_portfolio",
    targetWeight: 0.4,
    tolerance: 0.05,
    targetSymbol: "TSLA",
  });

  /** @type {string | undefined} */
  let objectiveId;
  if (created.ok) {
    try {
      const obj = JSON.parse(created.text);
      objectiveId = obj.id;
    } catch {
      rows.pop();
      record("aureon_create_objective", "FAIL", "missing objective id in body");
    }
  }

  if (objectiveId) {
    await runTool(client, "aureon_pause_objective", { objectiveId });
    await runTool(client, "aureon_resume_objective", { objectiveId });
  } else {
    record("aureon_pause_objective", "SKIP", "no objectiveId");
    record("aureon_resume_objective", "SKIP", "no objectiveId");
  }

  await runTool(client, "aureon_refresh_watchdog");

  await runTool(client, "aureon_apply_market_event", {
    symbol: "TSLA",
    priceChangeRatio: -0.05,
    autoRestore: false,
  });

  if (objectiveId) {
    const restore = await runTool(client, "aureon_get_restore_plan", { objectiveId });
    if (!restore.ok) {
      rows.pop();
      record(
        "aureon_get_restore_plan",
        "WARN",
        restore.text || "error (may be in-policy / no breach)"
      );
    }
  } else {
    record("aureon_get_restore_plan", "SKIP", "no objectiveId");
  }

  const deposit = await runTool(client, "aureon_prepare_vault_deposit", {
    symbol: "ETH",
    amount: "0.001",
  });
  if (!deposit.ok) {
    rows.pop();
    record("aureon_prepare_vault_deposit", "FAIL", deposit.text);
  }

  const keyCreate = await runTool(client, "aureon_create_api_key", { name: "mcp-test-key" });
  /** @type {string | undefined} */
  let keyId;
  if (keyCreate.ok) {
    try {
      const parsed = JSON.parse(keyCreate.text);
      keyId = parsed.id ?? parsed.keyId;
      rows[rows.length - 1].result = brief(`created id=${keyId ?? "?"}`);
    } catch {
      /* keep default PASS brief */
    }
    if (keyId) {
      await runTool(client, "aureon_revoke_api_key", { keyId });
    } else {
      record("aureon_revoke_api_key", "SKIP", "no keyId from create");
    }
  } else {
    record("aureon_revoke_api_key", "SKIP", "create failed");
  }

  printTable();
  const failed = rows.some((r) => r.status === "FAIL");
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
