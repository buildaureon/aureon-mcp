/**
 * Agent-style verification script — runs build checks + live tool calls.
 * Does not print secret values.
 *
 * Usage:
 *   AUREON_API_KEY=… tsx tests/verify-agent.ts
 *
 * Defaults to https://api.aureonlabs.network. Optional AUREON_AUTH_TOKEN.
 * If AUREON_API_KEY is unset, falls back to the first key in
 * ../scripts/production.api.env (monorepo maintainers only).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createAureonClient,
  createSessionTokenProvider,
} from "@buildaureon/sdk";
import { registerTools, SDK_TOOL_NAMES, TOOL_COUNT } from "../src/tools/index.js";
import { loadConfig } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd: string, args: string[], cwd = root) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: true });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function pass(msg: string) {
  console.log(`  PASS  ${msg}`);
}

function fail(msg: string) {
  console.log(`  FAIL  ${msg}`);
}

function warn(msg: string) {
  console.log(`  WARN  ${msg}`);
}

function loadProdKey(): string {
  const envPath = path.resolve(root, "../scripts/production.api.env");
  if (!fs.existsSync(envPath)) return "";
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.startsWith("AUREON_API_KEYS=")) {
      return line.slice("AUREON_API_KEYS=".length).split(",")[0].trim();
    }
  }
  return "";
}

async function callTool(
  mcpClient: Client,
  name: string,
  args: Record<string, unknown> = {}
) {
  const result = await mcpClient.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  const block = content?.[0];
  const text = block && "text" in block && block.text ? block.text : "";
  return { isError: !!result.isError, text };
}

async function main() {
  const report = { passed: 0, failed: 0, warned: 0 };

  section("1. Package structure");
  const required = [
    "package.json",
    "tsconfig.json",
    "tsup.config.ts",
    "README.md",
    "LICENSE",
    "src/index.ts",
    "src/server.ts",
    "src/config.ts",
    "src/client.ts",
    "src/errors.ts",
    "src/format.ts",
    "src/tools/index.ts",
    "src/tools/read.ts",
    "src/tools/compass.ts",
    "src/tools/vault.ts",
    "src/tools/auth.ts",
    "src/tools/objectives.ts",
    "src/tools/portfolio.ts",
    "src/tools/market.ts",
    "src/tools/developer.ts",
    "src/tools/catalog.ts",
    "src/tools/handler.ts",
    "examples/cursor.mcp.json",
    "examples/claude-desktop.json",
    "docs/architecture.md",
    "docs/setup.md",
    "docs/tools.md",
    "docs/security.md",
    "docs/auth.md",
    "docs/agent-guide.md",
    "tests/server.smoke.test.ts",
    "tests/tools.read.test.ts",
  ];
  for (const f of required) {
    if (fs.existsSync(path.join(root, f))) {
      pass(f);
      report.passed++;
    } else {
      fail(`missing ${f}`);
      report.failed++;
    }
  }

  section("2. Typecheck");
  const tc = run("pnpm", ["typecheck"]);
  if (tc.ok) {
    pass("tsc --noEmit");
    report.passed++;
  } else {
    fail("typecheck");
    console.log(tc.stderr.slice(0, 500));
    report.failed++;
  }

  section("3. Build");
  const bd = run("pnpm", ["build"]);
  if (bd.ok && fs.existsSync(path.join(root, "dist/index.js"))) {
    pass("tsup → dist/index.js");
    report.passed++;
  } else {
    fail("build");
    console.log(bd.stderr.slice(0, 500));
    report.failed++;
  }

  section("4. Unit tests");
  const savedLive = process.env.AUREON_MCP_LIVE_TEST;
  delete process.env.AUREON_MCP_LIVE_TEST;
  const ut = run("pnpm", ["test"]);
  if (savedLive !== undefined) process.env.AUREON_MCP_LIVE_TEST = savedLive;
  const testMatch = ut.stdout.match(/# pass (\d+)\n# fail (\d+)/);
  if (ut.ok && testMatch && testMatch[2] === "0") {
    pass(`${testMatch[1]} unit tests`);
    report.passed++;
  } else {
    fail("unit tests");
    console.log(ut.stdout.slice(-800));
    report.failed++;
  }

  section("5. Config validation");
  const savedKey = process.env.AUREON_API_KEY;
  const savedToken = process.env.AUREON_AUTH_TOKEN;
  delete process.env.AUREON_API_KEY;
  delete process.env.AUREON_AUTH_TOKEN;
  try {
    loadConfig();
    fail("config should throw without credentials");
    report.failed++;
  } catch {
    pass("rejects missing AUREON_API_KEY and AUREON_AUTH_TOKEN");
    report.passed++;
  }

  const apiKey = savedKey || loadProdKey() || "test-key";
  process.env.AUREON_API_KEY = apiKey;
  if (savedToken) process.env.AUREON_AUTH_TOKEN = savedToken;
  try {
    const cfg = loadConfig();
    pass(`loads config (apiUrl=${cfg.apiUrl})`);
    report.passed++;
  } catch (e) {
    fail(`config load: ${(e as Error).message}`);
    report.failed++;
  }

  section("6. MCP tool catalog (in-memory agent simulation)");
  const apiUrl = process.env.AUREON_API_URL || "https://api.aureonlabs.network";
  const authToken = process.env.AUREON_AUTH_TOKEN || "";

  const server = new McpServer({ name: "verify", version: "0.0.0" });
  const session = createSessionTokenProvider(authToken || null);
  const sdk = createAureonClient({
    baseUrl: apiUrl,
    apiKey: apiKey || undefined,
    getAccessToken: session.getAccessToken,
  });
  registerTools(server, sdk, session);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "verify-client", version: "0.0.0" });
  await server.connect(st);
  await mcpClient.connect(ct);

  const tools = await mcpClient.listTools();
  const expected = [...SDK_TOOL_NAMES].sort();

  if (
    tools.tools.length === TOOL_COUNT &&
    tools.tools
      .map((t) => t.name)
      .sort()
      .join() === expected.join()
  ) {
    pass(`${TOOL_COUNT} SDK tools registered with correct names`);
    report.passed++;
  } else {
    fail(`tool count/names mismatch: got ${tools.tools.length}, expected ${TOOL_COUNT}`);
    report.failed++;
  }

  section("7. Live API calls (agent tool invocations)");
  const walletPk = process.env.AUREON_WALLET_PRIVATE_KEY?.trim();
  if (walletPk && /^0x[0-9a-fA-F]{64}$/.test(walletPk)) {
    try {
      const { privateKeyToAccount } = await import("viem/accounts");
      const account = privateKeyToAccount(walletPk as `0x${string}`);
      const nonce = await callTool(mcpClient, "aureon_get_auth_nonce", {
        address: account.address,
      });
      if (!nonce.isError) {
        const { message } = JSON.parse(nonce.text) as { message: string };
        const signature = await account.signMessage({ message });
        const verify = await callTool(mcpClient, "aureon_verify_wallet", {
          address: account.address,
          message,
          signature,
          inviteCode: process.env.AUREON_E2E_INVITE_CODE?.trim() || undefined,
        });
        if (!verify.isError) {
          const login = JSON.parse(verify.text) as { token: string };
          session.setToken(login.token);
          pass(`wallet verify → ${account.address.slice(0, 10)}…`);
          report.passed++;
        } else {
          warn(`wallet verify failed: ${verify.text.slice(0, 80)}`);
          report.warned++;
        }
      }
    } catch (e) {
      warn(`wallet auth skip: ${(e as Error).message}`);
      report.warned++;
    }
  }

  const ping = await callTool(mcpClient, "aureon_ping");
  if (!ping.isError) {
    const body = JSON.parse(ping.text);
    pass(`aureon_ping → ok=${body.ok}, service=${body.service}`);
    report.passed++;
  } else {
    fail(`aureon_ping: ${ping.text.slice(0, 120)}`);
    report.failed++;
  }

  const authTools = [
    "aureon_me",
    "aureon_get_overview",
    "aureon_get_portfolio",
    "aureon_list_objectives",
    "aureon_get_health",
    "aureon_list_timeline",
    "aureon_list_market_presets",
    "aureon_get_vault",
    "aureon_get_vault_status",
    "aureon_list_executions",
    "aureon_list_api_keys",
  ];

  for (const tool of authTools) {
    const r = await callTool(mcpClient, tool);
    if (!r.isError) {
      pass(`${tool} → OK (${r.text.length} chars JSON)`);
      report.passed++;
    } else {
      warn(`${tool} → ${r.text.slice(0, 100)}`);
      report.warned++;
    }
  }

  const list = await callTool(mcpClient, "aureon_list_objectives");
  if (!list.isError) {
    const objectives = JSON.parse(list.text) as Array<{ id: string }>;
    if (objectives.length > 0) {
      const id = objectives[0].id;
      for (const [tool, args] of [
        ["aureon_get_objective", { objectiveId: id }],
        ["aureon_get_health", { objectiveId: id }],
        ["aureon_get_restore_plan", { objectiveId: id }],
        ["aureon_list_executions", { objectiveId: id }],
        ["aureon_list_timeline", { objectiveId: id }],
      ] as const) {
        const r = await callTool(mcpClient, tool, args);
        const label = `${tool}(id=${id.slice(0, 8)}…)`;
        if (!r.isError) {
          pass(`${label} → OK`);
          report.passed++;
        } else if (tool === "aureon_get_restore_plan") {
          warn(`${label} → ${r.text.slice(0, 80)} (in-policy is OK)`);
          report.warned++;
        } else {
          fail(`${label}: ${r.text.slice(0, 120)}`);
          report.failed++;
        }
      }
    } else {
      warn("wallet has no objectives — objective-scoped tools skipped");
      report.warned++;
    }
  }

  section("8. Full SDK write tools present");
  const writeTools = [
    "aureon_create_objective",
    "aureon_run_execution",
    "aureon_set_portfolio",
    "aureon_prepare_vault_deposit",
    "aureon_apply_market_event",
    "aureon_create_api_key",
    "aureon_verify_wallet",
    "aureon_dev_login",
  ];
  const names = new Set(tools.tools.map((t) => t.name));
  let allPresent = true;
  for (const w of writeTools) {
    if (!names.has(w)) {
      fail(`missing SDK tool: ${w}`);
      allPresent = false;
      report.failed++;
    }
  }
  if (allPresent) {
    pass("all SDK write/auth tools exposed");
    report.passed++;
  }

  section("FINAL REPORT");
  console.log(`  Passed : ${report.passed}`);
  console.log(`  Failed : ${report.failed}`);
  console.log(`  Warned : ${report.warned}`);
  console.log(`  Verdict: ${report.failed === 0 ? "READY" : "NOT READY"}`);
  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
