import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerVaultTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_get_vault",
    "Vault overview — balances, tokens, deposit history",
    {},
    async () => {
      try {
        return ok(await client.getVault());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_vault_status",
    "Compact vault funding status — ready state before restore",
    {},
    async () => {
      try {
        return ok(await client.getVaultStatus());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_prepare_vault_deposit",
    "Prepare unsigned vault deposit steps. Returns calldata only — the host must sign/broadcast with a wallet private key. API key alone cannot move funds.",
    {
      symbol: z.string().describe("Deposit symbol (ETH or allowlisted ERC-20)"),
      amount: z.string().describe("Human-readable amount"),
    },
    async ({ symbol, amount }) => {
      try {
        return ok(await client.prepareVaultDeposit({ symbol, amount }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_prepare_vault_withdraw",
    "Prepare unsigned vault withdraw steps. Returns calldata only — host must sign/broadcast. API key alone cannot move funds.",
    {
      symbol: z.string().optional().describe("Withdraw symbol (default WETH; not ETH)"),
      amount: z.string().describe("Human-readable amount"),
    },
    async ({ symbol, amount }) => {
      try {
        return ok(await client.prepareVaultWithdraw({ symbol, amount }));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
