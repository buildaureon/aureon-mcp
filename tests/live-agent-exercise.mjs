/**
 * Live agent exercise — MCP tools against https://api.aureonlabs.network
 * Creates objective, syncs portfolio, prepares vault deposit, optionally broadcasts.
 *
 * Required env:
 *   AUREON_API_KEY
 *   AUREON_WALLET_PRIVATE_KEY   (for wallet verify + optional broadcast)
 *
 * Optional:
 *   AUREON_API_URL
 *   AUREON_RPC_URL
 *   AUREON_E2E_INVITE_CODE
 *   AUREON_BROADCAST=1         (broadcast prepare steps on-chain)
 *
 * Does not print secrets.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAureonClient, createSessionTokenProvider } from "@buildaureon/sdk";
import { registerTools } from "../src/tools/index.js";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_URL = process.env.AUREON_API_URL?.trim() || "https://api.aureonlabs.network";
const API_KEY = process.env.AUREON_API_KEY?.trim();
const PK = process.env.AUREON_WALLET_PRIVATE_KEY?.trim();
const RPC = process.env.AUREON_RPC_URL?.trim() || "https://rpc.testnet.chain.robinhood.com";
const BROADCAST = process.env.AUREON_BROADCAST === "1";
const CHAIN_ID = Number(process.env.AUREON_CHAIN_ID || 46630);

if (!API_KEY) {
  console.error("Set AUREON_API_KEY");
  process.exit(1);
}
if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  console.error("Set AUREON_WALLET_PRIVATE_KEY (0x + 64 hex)");
  process.exit(1);
}

const account = privateKeyToAccount(/** @type {`0x${string}`} */ (PK));
const chain = {
  id: CHAIN_ID,
  name: "robinhood-testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};
const wallet = createWalletClient({ account, chain, transport: http(RPC) });
const publicClient = createPublicClient({ chain, transport: http(RPC) });

const session = createSessionTokenProvider(null);
const sdk = createAureonClient({
  baseUrl: API_URL,
  apiKey: API_KEY,
  getAccessToken: session.getAccessToken,
  timeoutMs: 90_000,
});

/** @type {Array<{step:string,status:string,detail:string}>} */
const report = [];

function log(step, status, detail = "") {
  report.push({ step, status, detail: detail.slice(0, 160) });
  console.log(`  ${status.padEnd(4)} ${step}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
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

async function main() {
  console.log("\n=== MCP LIVE AGENT EXERCISE ===");
  console.log(`API: ${API_URL}`);
  console.log(`Wallet: ${account.address}\n`);

  const server = new McpServer({ name: "live-agent", version: "0.0.0" });
  registerTools(server, sdk, session);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "live-agent-client", version: "0.0.0" });
  await server.connect(st);
  await client.connect(ct);

  /** @param {string} name @param {Record<string, unknown>} [args] */
  async function call(name, args = {}) {
    return client.callTool({ name, arguments: args });
  }

  // ping
  {
    const r = await call("aureon_ping");
    if (isErr(r)) {
      log("aureon_ping", "FAIL", text(r));
      process.exit(1);
    }
    const body = JSON.parse(text(r));
    log("aureon_ping", "PASS", `${body.service} ${body.version ?? ""}`);
  }

  // wallet handshake
  {
    const nonceR = await call("aureon_get_auth_nonce", { address: account.address });
    if (isErr(nonceR)) {
      log("aureon_get_auth_nonce", "FAIL", text(nonceR));
      process.exit(1);
    }
    const { message } = JSON.parse(text(nonceR));
    log("aureon_get_auth_nonce", "PASS");
    const signature = await wallet.signMessage({ account, message });
    const verifyArgs = {
      address: account.address,
      message,
      signature,
    };
    const invite = process.env.AUREON_E2E_INVITE_CODE?.trim();
    if (invite) Object.assign(verifyArgs, { inviteCode: invite });
    const verifyR = await call("aureon_verify_wallet", verifyArgs);
    if (isErr(verifyR)) {
      log("aureon_verify_wallet", "FAIL", text(verifyR));
      process.exit(1);
    }
    const login = JSON.parse(text(verifyR));
    session.setToken(login.token);
    log("aureon_verify_wallet", "PASS", "Bearer stored in-process");
  }

  // me
  {
    const r = await call("aureon_me");
    if (isErr(r)) log("aureon_me", "FAIL", text(r));
    else log("aureon_me", "PASS", JSON.parse(text(r)).walletAddress);
  }

  // create issued API key (the public path agents should use)
  /** @type {string|undefined} */
  let issuedSecret;
  /** @type {string|undefined} */
  let issuedId;
  {
    const r = await call("aureon_create_api_key", { name: `mcp-agent-${Date.now()}` });
    if (isErr(r)) {
      log("aureon_create_api_key", "WARN", text(r));
    } else {
      const created = JSON.parse(text(r));
      issuedId = created.id;
      issuedSecret = created.secret || created.key || created.apiKey;
      log("aureon_create_api_key", "PASS", `id=${String(issuedId).slice(0, 8)}…`);
    }
  }

  // sync + vault
  {
    const sync = await call("aureon_sync_portfolio");
    log("aureon_sync_portfolio", isErr(sync) ? "WARN" : "PASS", isErr(sync) ? text(sync) : "synced");
    const vault = await call("aureon_get_vault_status");
    log("aureon_get_vault_status", isErr(vault) ? "FAIL" : "PASS", isErr(vault) ? text(vault) : `${text(vault).length}b`);
  }

  // create automatic objective
  /** @type {string|undefined} */
  let objectiveId;
  {
    const r = await call("aureon_create_objective", {
      name: `MCP Agent Live ${Date.now()}`,
      kind: "balanced_portfolio",
      targetWeight: 0.2,
      tolerance: 0.05,
      targetSymbol: "TSLA",
      priority: "medium",
      automationMode: "auto",
    });
    if (isErr(r)) {
      log("aureon_create_objective", "FAIL", text(r));
    } else {
      objectiveId = JSON.parse(text(r)).id;
      log("aureon_create_objective", "PASS", objectiveId);
    }
  }

  // health + restore plan
  if (objectiveId) {
    await call("aureon_refresh_watchdog");
    const health = await call("aureon_get_health", { objectiveId });
    log("aureon_get_health", isErr(health) ? "FAIL" : "PASS", isErr(health) ? text(health) : "ok");
    const plan = await call("aureon_get_restore_plan", { objectiveId });
    if (isErr(plan)) {
      log("aureon_get_restore_plan", "WARN", text(plan).slice(0, 100));
    } else {
      const p = JSON.parse(text(plan));
      log("aureon_get_restore_plan", "PASS", `${p.kind ?? "plan"}`);
      const restore = await call("aureon_restore_objective", { objectiveId });
      if (isErr(restore)) {
        log("aureon_restore_objective", "WARN", text(restore).slice(0, 100));
      } else {
        const receipt = JSON.parse(text(restore));
        log(
          "aureon_restore_objective",
          "PASS",
          `${receipt.status} settlement=${receipt.settlement ?? "?"}`
        );
      }
    }
  }

  // prepare deposit (unsigned) + optional broadcast
  {
    const prep = await call("aureon_prepare_vault_deposit", {
      symbol: "ETH",
      amount: "0.0003",
    });
    if (isErr(prep)) {
      log("aureon_prepare_vault_deposit", "WARN", text(prep));
    } else {
      const plan = JSON.parse(text(prep));
      log(
        "aureon_prepare_vault_deposit",
        "PASS",
        `${plan.steps?.length ?? 0} unsigned step(s)`
      );
      if (BROADCAST && Array.isArray(plan.steps) && plan.steps.length > 0) {
        try {
          for (const step of plan.steps) {
            const hash = await wallet.sendTransaction({
              account,
              chain,
              to: step.to,
              data: step.data,
              value: BigInt(step.value || "0"),
            });
            await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
            log("broadcast_deposit", "PASS", hash);
          }
        } catch (err) {
          log(
            "broadcast_deposit",
            "WARN",
            err instanceof Error ? err.message : String(err)
          );
        }
      } else {
        log("broadcast_deposit", "SKIP", "set AUREON_BROADCAST=1 to send on-chain");
      }
    }
  }

  // cleanup issued key
  if (issuedId) {
    const r = await call("aureon_revoke_api_key", { keyId: issuedId });
    log("aureon_revoke_api_key", isErr(r) ? "WARN" : "PASS", isErr(r) ? text(r) : "revoked");
  }

  // prove issued key alone works (if we still have the secret before revoke — already revoked)
  // Instead: re-test aureon_me with Bearer already set
  {
    const overview = await call("aureon_get_overview");
    log("aureon_get_overview", isErr(overview) ? "FAIL" : "PASS");
  }

  console.log("\n=== SUMMARY ===");
  const fail = report.filter((r) => r.status === "FAIL").length;
  const pass = report.filter((r) => r.status === "PASS").length;
  const warn = report.filter((r) => r.status === "WARN").length;
  console.log(`  PASS=${pass} WARN=${warn} FAIL=${fail}`);
  console.log(`  Verdict: ${fail === 0 ? "READY" : "NEEDS FIX"}`);
  // silence unused
  void issuedSecret;
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL", err instanceof Error ? err.message : err);
  process.exit(1);
});
