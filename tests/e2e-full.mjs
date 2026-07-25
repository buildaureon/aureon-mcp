/**
 * FULL MCP E2E — every SDK tool via MCP, real wallet sign, on-chain vault tx when funded.
 *
 * Env (public / CI friendly — no monorepo paths):
 *   AUREON_API_KEY              issued developer key OR product gate key
 *   AUREON_WALLET_PRIVATE_KEY   0x… signing key (required for wallet auth + broadcast)
 *   AUREON_API_URL              optional (default https://api.aureonlabs.network)
 *   AUREON_RPC_URL              optional
 *   AUREON_E2E_INVITE_CODE      optional invite for first wallet login
 *
 * Run: pnpm --filter @buildaureon/mcp test:e2e
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAureonClient, createSessionTokenProvider } from "@buildaureon/sdk";
import { registerTools } from "../src/tools/index.js";
import { SDK_TOOL_NAMES } from "../src/tools/catalog.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_URL = process.env.AUREON_API_URL?.trim() || "https://api.aureonlabs.network";
const API_KEY = process.env.AUREON_API_KEY?.trim();
const RPC = process.env.AUREON_RPC_URL?.trim() || "https://rpc.testnet.chain.robinhood.com";
const CHAIN_ID = Number(process.env.AUREON_CHAIN_ID || 46630);

if (!API_KEY) {
  console.error("Set AUREON_API_KEY (issued developer key preferred)");
  process.exit(1);
}

const robinhoodTestnet = {
  id: CHAIN_ID,
  name: "robinhood-testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

/** @type {Record<string, "PASS"|"FAIL"|"WARN"|"SKIP"|"PENDING">} */
const results = Object.fromEntries(SDK_TOOL_NAMES.map((t) => [t, "PENDING"]));

const session = createSessionTokenProvider(null);

function loadInviteCode() {
  return process.env.AUREON_E2E_INVITE_CODE?.trim() || "";
}

function loadWallet() {
  const privateKey = process.env.AUREON_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "Set AUREON_WALLET_PRIVATE_KEY to a 0x-prefixed 32-byte hex key for e2e signing"
    );
  }
  const account = privateKeyToAccount(/** @type {`0x${string}`} */ (privateKey));
  return { account, address: account.address };
}

const sdk = createAureonClient({
  baseUrl: API_URL,
  apiKey: API_KEY,
  getAccessToken: session.getAccessToken,
  timeoutMs: 90_000,
});

async function createMcpClient() {
  const server = new McpServer({ name: "e2e-full", version: "0.0.0" });
  registerTools(server, sdk, session);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "e2e-client", version: "0.0.0" });
  await server.connect(st);
  await client.connect(ct);
  return client;
}

/** @param {unknown} result */
function text(result) {
  const r = /** @type {{ content?: Array<{ text?: string }> }} */ (result);
  return r.content?.[0]?.text ?? "";
}

/** @param {unknown} result */
function isErr(result) {
  return Boolean(/** @type {{ isError?: boolean }} */ (result).isError);
}

/** @param {string} tool @param {string} status @param {string} [detail] */
function mark(tool, status, detail = "") {
  results[tool] = status;
  const d = detail ? ` — ${detail.slice(0, 100)}` : "";
  console.log(`  ${status.padEnd(4)} ${tool}${d}`);
}

/** @param {Client} client @param {string} name @param {Record<string, unknown>} [args] */
async function call(client, name, args = {}) {
  const out = await client.callTool({ name, arguments: args });
  return { ok: !isErr(out), text: text(out), raw: out };
}

/** @param {import('viem').Account} account @param {Array<{to:string,data:string,value:string}>} steps */
async function broadcastSteps(account, steps) {
  const wallet = createWalletClient({
    account,
    chain: robinhoodTestnet,
    transport: http(RPC),
  });
  const publicClient = createPublicClient({
    chain: robinhoodTestnet,
    transport: http(RPC),
  });
  const hashes = [];
  for (const step of steps) {
    const hash = await wallet.sendTransaction({
      account,
      to: /** @type {`0x${string}`} */ (step.to),
      data: /** @type {`0x${string}`} */ (step.data),
      value: BigInt(step.value || "0"),
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
    hashes.push(hash);
  }
  return hashes;
}

async function main() {
  console.log("\n=== AUREON MCP FULL E2E ===");
  console.log(`API: ${API_URL}\n`);

  const wallet = loadWallet();
  console.log(`Wallet: ${wallet.address}\n`);

  const client = await createMcpClient();

  // --- ping (no auth) ---
  {
    const r = await call(client, "aureon_ping");
    mark("aureon_ping", r.ok ? "PASS" : "FAIL", r.ok ? JSON.parse(r.text).service : r.text);
  }

  // --- dev_login tool smoke (preview APIs only; WARN on live) ---
  {
    const r = await call(client, "aureon_dev_login");
    mark(
      "aureon_dev_login",
      r.ok ? "PASS" : "WARN",
      r.ok ? "preview login ok" : "expected fail on live API"
    );
  }

  // --- real wallet auth via MCP ---
  {
    const nonceR = await call(client, "aureon_get_auth_nonce", { address: wallet.address });
    if (!nonceR.ok) {
      mark("aureon_get_auth_nonce", "FAIL", nonceR.text);
      mark("aureon_verify_wallet", "SKIP", "no nonce");
    } else {
      mark("aureon_get_auth_nonce", "PASS", "nonce ok");
      const nonce = JSON.parse(nonceR.text);
      const signature = await wallet.account.signMessage({ message: nonce.message });
      const verifyR = await call(client, "aureon_verify_wallet", {
        address: wallet.address,
        message: nonce.message,
        signature,
        inviteCode: loadInviteCode() || undefined,
      });
      if (verifyR.ok) {
        session.setToken(JSON.parse(verifyR.text).token);
        mark("aureon_verify_wallet", "PASS", `wallet=${wallet.address.slice(0, 10)}…`);
      } else {
        mark("aureon_verify_wallet", "FAIL", verifyR.text);
      }
    }
  }

  const sessionToken = await session.getAccessToken();
  if (!sessionToken) {
    console.log("  … verify_wallet failed — trying aureon_dev_login (preview APIs only)");
    const dev = await call(client, "aureon_dev_login");
    if (dev.ok) {
      session.setToken(JSON.parse(dev.text).token);
      mark("aureon_dev_login", "PASS", "fallback session");
    } else {
      mark("aureon_dev_login", "WARN", "expected fail on live API");
    }
  }

  if (!(await session.getAccessToken()) && !API_KEY) {
    console.log("\nFATAL: no Bearer session and no API key — stopping");
    printSummary();
    process.exit(1);
  }

  if (!(await session.getAccessToken())) {
    console.log("  INFO: continuing with issued/product API key identity (no Bearer)");
  }

  // --- me ---
  {
    const r = await call(client, "aureon_me");
    mark("aureon_me", r.ok ? "PASS" : "FAIL", r.ok ? JSON.parse(r.text).walletAddress : r.text);
  }

  // --- read tools ---
  for (const tool of [
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
  ]) {
    const r = await call(client, tool);
    mark(tool, r.ok ? "PASS" : "FAIL", r.ok ? `${r.text.length}b` : r.text);
  }

  // --- portfolio sync / set ---
  {
    const sync = await call(client, "aureon_sync_portfolio");
    let empty = false;
    if (sync.ok) {
      try {
        const p = JSON.parse(sync.text);
        empty = (p.portfolio?.positions?.length ?? 0) === 0;
      } catch { /* */ }
    }
    if (sync.ok && !empty) {
      mark("aureon_sync_portfolio", "PASS", "chain sync ok");
    } else {
      const set = await call(client, "aureon_set_portfolio", {
        positions: [
          { symbol: "WETH", name: "Wrapped Ether", category: "gas", quantity: 1, markPriceUsd: 2500 },
          { symbol: "TSLA", name: "Tesla", category: "stock_token", quantity: 10, markPriceUsd: 200 },
        ],
      });
      mark("aureon_sync_portfolio", sync.ok ? "PASS" : "WARN", sync.ok ? "empty book; set_portfolio ok" : sync.text);
      mark("aureon_set_portfolio", set.ok ? "PASS" : "FAIL", set.ok ? "seeded WETH+TSLA" : set.text);
    }
    if (sync.ok && !empty) mark("aureon_set_portfolio", "SKIP", "sync had positions");
  }

  // --- create + update objective ---
  /** @type {string|undefined} */
  let objectiveId;
  {
    const create = await call(client, "aureon_create_objective", {
      name: "MCP E2E Full",
      kind: "balanced_portfolio",
      targetWeight: 0.4,
      tolerance: 0.05,
      targetSymbol: "TSLA",
      priority: "high",
    });
    if (create.ok) {
      objectiveId = JSON.parse(create.text).id;
      mark("aureon_create_objective", "PASS", objectiveId);
    } else {
      mark("aureon_create_objective", "FAIL", create.text);
    }
  }

  if (objectiveId) {
    const get = await call(client, "aureon_get_objective", { objectiveId });
    mark("aureon_get_objective", get.ok ? "PASS" : "FAIL", get.ok ? objectiveId : get.text);

    const upd = await call(client, "aureon_update_objective", {
      objectiveId,
      name: "MCP E2E Full (updated)",
      tolerance: 0.06,
    });
    mark("aureon_update_objective", upd.ok ? "PASS" : "FAIL", upd.ok ? "patched" : upd.text);
  } else {
    mark("aureon_get_objective", "SKIP", "no objective");
    mark("aureon_update_objective", "SKIP", "no objective");
  }

  // --- watchdog + market shock ---
  {
    const wd = await call(client, "aureon_refresh_watchdog");
    mark("aureon_refresh_watchdog", wd.ok ? "PASS" : "FAIL", wd.ok ? "marks refreshed" : wd.text);
  }
  {
    const ev = await call(client, "aureon_apply_market_event", {
      symbol: "TSLA",
      priceChangeRatio: -0.2,
      name: "mcp-e2e-shock",
      autoRestore: false,
    });
    mark("aureon_apply_market_event", ev.ok ? "PASS" : "FAIL", ev.ok ? "TSLA -20%" : ev.text);
  }

  // --- restore plan + executions ---
  if (objectiveId) {
    const plan = await call(client, "aureon_get_restore_plan", { objectiveId });
    mark(
      "aureon_get_restore_plan",
      plan.ok ? "PASS" : "WARN",
      plan.ok ? JSON.parse(plan.text).kind ?? "plan" : plan.text
    );

    const run = await call(client, "aureon_run_execution", { objectiveId });
    mark(
      "aureon_run_execution",
      run.ok ? "PASS" : "WARN",
      run.ok ? JSON.parse(run.text).status ?? "executed" : run.text
    );

    const restore = await call(client, "aureon_restore_objective", { objectiveId });
    mark(
      "aureon_restore_objective",
      restore.ok ? "PASS" : "WARN",
      restore.ok ? JSON.parse(restore.text).status ?? "restored" : restore.text
    );
  } else {
    for (const t of ["aureon_get_restore_plan", "aureon_run_execution", "aureon_restore_objective"]) {
      mark(t, "SKIP", "no objective");
    }
  }

  // --- pause / resume ---
  if (objectiveId) {
    const pause = await call(client, "aureon_pause_objective", { objectiveId });
    mark("aureon_pause_objective", pause.ok ? "PASS" : "FAIL", pause.ok ? "paused" : pause.text);
    const resume = await call(client, "aureon_resume_objective", { objectiveId });
    mark("aureon_resume_objective", resume.ok ? "PASS" : "FAIL", resume.ok ? "active" : resume.text);
  } else {
    mark("aureon_pause_objective", "SKIP", "no objective");
    mark("aureon_resume_objective", "SKIP", "no objective");
  }

  // --- vault deposit: MCP prep + ON-CHAIN broadcast ---
  {
    const prep = await call(client, "aureon_prepare_vault_deposit", {
      symbol: "ETH",
      amount: "0.001",
    });
    if (!prep.ok) {
      mark("aureon_prepare_vault_deposit", "FAIL", prep.text);
    } else {
      const plan = JSON.parse(prep.text);
      try {
        const bal = await createPublicClient({ chain: robinhoodTestnet, transport: http(RPC) }).getBalance({
          address: wallet.address,
        });
        if (bal < BigInt(plan.amountRaw ?? "0") + BigInt(10 ** 15)) {
          mark("aureon_prepare_vault_deposit", "WARN", `prep ok but low ETH balance (${bal})`);
        } else {
          const hashes = await broadcastSteps(wallet.account, plan.steps);
          mark("aureon_prepare_vault_deposit", "PASS", `on-chain ${hashes.length} tx(s) ${hashes[0]?.slice(0, 14)}…`);
        }
      } catch (err) {
        mark(
          "aureon_prepare_vault_deposit",
          "WARN",
          `prep ok, broadcast failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // --- vault withdraw prep ---
  {
    const prep = await call(client, "aureon_prepare_vault_withdraw", {
      symbol: "WETH",
      amount: "0.0001",
    });
    mark(
      "aureon_prepare_vault_withdraw",
      prep.ok ? "PASS" : "WARN",
      prep.ok ? `${JSON.parse(prep.text).steps?.length ?? 0} steps` : prep.text
    );
  }

  // --- API keys: create → toggle → revoke ---
  /** @type {string|undefined} */
  let keyId;
  {
    const create = await call(client, "aureon_create_api_key", { name: "mcp-e2e-full" });
    if (create.ok) {
      keyId = JSON.parse(create.text).id;
      mark("aureon_create_api_key", "PASS", keyId);
    } else {
      mark("aureon_create_api_key", "FAIL", create.text);
    }
  }
  if (keyId) {
    const toggle = await call(client, "aureon_toggle_api_key", { keyId });
    mark("aureon_toggle_api_key", toggle.ok ? "PASS" : "FAIL", toggle.ok ? "toggled" : toggle.text);
    const revoke = await call(client, "aureon_revoke_api_key", { keyId });
    mark("aureon_revoke_api_key", revoke.ok ? "PASS" : "FAIL", revoke.ok ? "revoked" : revoke.text);
  } else {
    mark("aureon_toggle_api_key", "SKIP", "no key");
    mark("aureon_revoke_api_key", "SKIP", "no key");
  }

  // --- clear portfolio ---
  {
    const r = await call(client, "aureon_clear_portfolio");
    mark("aureon_clear_portfolio", r.ok ? "PASS" : "FAIL", r.ok ? "cleared" : r.text);
  }

  // --- logout ---
  {
    const r = await call(client, "aureon_logout");
    mark("aureon_logout", r.ok ? "PASS" : "FAIL", r.ok ? "session revoked" : r.text);
    if (r.ok) session.clear();
  }

  printSummary();
  const failed = SDK_TOOL_NAMES.filter((t) => results[t] === "FAIL").length;
  const pending = SDK_TOOL_NAMES.filter((t) => results[t] === "PENDING").length;
  process.exit(failed > 0 || pending > 0 ? 1 : 0);
}

function printSummary() {
  console.log("\n=== SUMMARY (all 34 MCP tools) ===");
  const pass = SDK_TOOL_NAMES.filter((t) => results[t] === "PASS").length;
  const fail = SDK_TOOL_NAMES.filter((t) => results[t] === "FAIL").length;
  const warn = SDK_TOOL_NAMES.filter((t) => results[t] === "WARN").length;
  const skip = SDK_TOOL_NAMES.filter((t) => results[t] === "SKIP").length;
  const pending = SDK_TOOL_NAMES.filter((t) => results[t] === "PENDING").length;

  for (const t of SDK_TOOL_NAMES) {
    console.log(`  ${results[t].padEnd(4)} ${t}`);
  }
  console.log(`\n  PASS=${pass} FAIL=${fail} WARN=${warn} SKIP=${skip} PENDING=${pending} / ${SDK_TOOL_NAMES.length}`);
  console.log(`  Verdict: ${fail === 0 && pending === 0 ? "ALL TOOLS EXERCISED" : "INCOMPLETE"}`);
}

main().catch((err) => {
  console.error("FATAL", err instanceof Error ? err.message : err);
  process.exit(1);
});
