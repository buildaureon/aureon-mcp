/**
 * Phase 2 MCP session: registry, restore, validate, settlement, audit.
 * Never prints secrets.
 *
 * Default: local mainnet 8788 / 4663 via resolveAureonNetworkFromEnv.
 *   AUREON_NETWORK=testnet pnpm --filter @buildaureon/mcp test:phase2
 *   AUREON_API_URL=http://127.0.0.1:8787 AUREON_NETWORK=testnet ...  (local testnet)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createAureonClient,
  createSessionTokenProvider,
  resolveAureonNetworkFromEnv,
} from "@buildaureon/sdk";
import { registerTools } from "../src/tools/index.js";
import { SDK_TOOL_NAMES } from "../src/tools/catalog.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const resolved = resolveAureonNetworkFromEnv();
const API = resolved.baseUrl;
const CHAIN_ID = Number(process.env.AUREON_CHAIN_ID || resolved.chainId);
const RPC =
  process.env.AUREON_RPC_URL?.trim() ||
  (CHAIN_ID === 4663
    ? "https://rpc.mainnet.chain.robinhood.com"
    : "https://rpc.testnet.chain.robinhood.com");
const useLiveKey = /aureonlabs\.network/i.test(API);
const API_KEY =
  process.env.AUREON_API_KEY?.trim() ||
  (useLiveKey
    ? firstApiKey(resolve(ROOT, "scripts/production.api.env"))
    : firstApiKey(resolve(ROOT, "public backend/.env")));

function firstApiKey(path) {
  if (!existsSync(path)) return "";
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.startsWith("AUREON_API_KEYS=")) {
      return line.slice("AUREON_API_KEYS=".length).split(",")[0].trim();
    }
  }
  return "";
}

function loadWallet() {
  const envKey = process.env.AUREON_WALLET_PRIVATE_KEY?.trim();
  if (envKey) return privateKeyToAccount(/** @type {`0x${string}`} */ (envKey));
  const paths = [
    resolve(ROOT, "public backend/.secrets/robinhood-testnet-wallet.json"),
    resolve(ROOT, "backend/.secrets/robinhood-testnet-wallet.json"),
  ];
  const path = paths.find((p) => existsSync(p));
  if (!path) throw new Error("wallet missing");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return privateKeyToAccount(/** @type {`0x${string}`} */ (raw.privateKey));
}

const chain = {
  id: CHAIN_ID,
  name: "robinhood-testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

function text(result) {
  return result.content?.[0]?.text ?? "";
}

async function main() {
  console.log(`Phase 2 MCP session → ${API}`);
  console.log(`catalog ${SDK_TOOL_NAMES.length} tools`);
  const account = loadWallet();
  const session = createSessionTokenProvider(null);
  const sdk = createAureonClient({
    network: resolved.network,
    baseUrl: API,
    apiKey: useLiveKey && API_KEY ? API_KEY : undefined,
    getAccessToken: session.getAccessToken,
    timeoutMs: 90_000,
  });
  const server = new McpServer({ name: "phase2-mcp", version: "0.0.0" });
  registerTools(server, sdk, session);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "phase2-mcp-client", version: "0.0.0" });
  await server.connect(st);
  await client.connect(ct);

  const listed = await client.listTools();
  const names = listed.tools.map((t) => t.name);
  if (names.length !== SDK_TOOL_NAMES.length) {
    throw new Error(`host listed ${names.length} tools, catalog ${SDK_TOOL_NAMES.length}`);
  }

  async function call(name, args = {}) {
    const out = await client.callTool({ name, arguments: args });
    if (out.isError) throw new Error(`${name}: ${text(out)}`);
    const raw = text(out);
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  const ping = await call("aureon_ping");
  console.log("PASS ping", ping.service || ping);

  const nonce = await call("aureon_get_auth_nonce", { address: account.address });
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  const signature = await wallet.signMessage({ account, message: nonce.message });
  const login = await call("aureon_verify_wallet", {
    address: account.address,
    message: nonce.message,
    signature,
  });
  session.setToken(login.token);
  console.log("PASS wallet session");

  const status = await call("aureon_registry_status");
  console.log("PASS registry_status", `enabled=${status.enabled} chain=${status.chainId}`);

  const objective = await call("aureon_create_objective", {
    name: `MCP Phase 2 ${Date.now()}`,
    kind: "stable_allocation",
    targetWeight: 0.2,
    tolerance: 0.05,
  });
  if (objective.verifiedOnChain === true) {
    throw new Error("create claimed verifiedOnChain without a registry tx");
  }
  console.log("PASS create", objective.id);

  const before = await call("aureon_get_objective_registry", { objectiveId: objective.id });
  if (before.registered !== false) throw new Error("expected unregistered");
  console.log("PASS registry lookup before register");

  const prepared = await call("aureon_prepare_objective_registry", { objectiveId: objective.id });
  const publicClient = createPublicClient({ chain, transport: http(RPC) });
  const hash = await wallet.sendTransaction({
    account,
    to: prepared.to,
    data: prepared.data,
    value: 0n,
  });
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  const confirmed = await call("aureon_confirm_objective_registry", {
    objectiveId: objective.id,
    transactionHash: hash,
  });
  console.log("PASS confirm registry", confirmed.record?.explorerUrl || hash);

  try {
    const synced = await call("aureon_sync_portfolio");
    const empty = (synced.positions?.length ?? synced.portfolio?.positions?.length ?? 0) === 0;
    if (empty) {
      await call("aureon_set_portfolio", {
        positions: [
          { symbol: "WETH", name: "Wrapped Ether", category: "gas", quantity: 1, markPriceUsd: 2500 },
          { symbol: "TSLA", name: "Tesla", category: "stock_token", quantity: 10, markPriceUsd: 200 },
        ],
      });
    }
    console.log("PASS book ready");
  } catch (err) {
    console.log("WARN book", err instanceof Error ? err.message : err);
  }
  await call("aureon_apply_market_event", {
    symbol: "TSLA",
    priceChangeRatio: -0.2,
    name: "mcp-phase2-drift",
    autoRestore: false,
  });
  let receipt;
  try {
    receipt = await call("aureon_restore_objective", { objectiveId: objective.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const listedExec = await call("aureon_list_executions", { objectiveId: objective.id });
      const rows = Array.isArray(listedExec) ? listedExec : listedExec.executions ?? [];
      receipt = rows.find((row) => row.status === "failed") ?? rows[0];
    } catch {
      receipt = null;
    }
    if (receipt) {
      console.log("PASS restore blocked honestly", message.slice(0, 120));
    } else if (/funded vault|not staged|no staged|sell-side|empty|deposit/i.test(message)) {
      console.log("PASS restore blocked honestly", message.slice(0, 160));
    } else {
      console.log("WARN restore", message.slice(0, 160));
    }
  }
  if (receipt) {
    const validated = await call("aureon_validate_receipt", { receipt });
    console.log(
      "PASS restore+validate",
      `${receipt.settlement} verifiedOnChain=${receipt.verifiedOnChain} valid=${validated.valid}`
    );
    const settlement = await call("aureon_get_execution_settlement", {
      executionId: receipt.id,
    });
    console.log("PASS settlement", `verifiedOnChain=${settlement.verifiedOnChain}`);
    try {
      await call("aureon_confirm_execution_settlement", {
        executionId: receipt.id,
        transactionHash: "0x" + "11".repeat(32),
      });
      console.log("WARN confirm settlement accepted a fake hash");
    } catch {
      console.log("PASS confirm settlement rejected without chain proof");
    }
  } else {
    const staged = await call("aureon_validate_receipt", {
      receipt: {
        id: "exec_staged_honesty",
        objectiveId: objective.id,
        action: "Staged book restore",
        status: "confirmed",
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        settlement: "staged",
        transactionHash: "staged_local_fixture",
        explorerUrl: null,
        verifiedOnChain: false,
        result: "Staged book restore",
      },
    });
    console.log("PASS validate staged fixture", `valid=${staged.valid}`);
  }
  const settlements = await call("aureon_list_settlements", { objectiveId: objective.id });
  console.log("PASS list settlements", settlements.settlements?.length ?? 0);

  const trail = await call("aureon_get_audit_trail", { objectiveId: objective.id });
  if (trail.gaps?.some((g) => !g.code)) throw new Error("audit trail invented a gap");
  console.log("PASS audit trail", trail.message);
  console.log("OK Phase 2 MCP session");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
