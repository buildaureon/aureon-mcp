import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

const positionInput = z.object({
  symbol: z.string(),
  name: z.string(),
  category: z.enum(["stable", "stock_token", "gas", "other"]),
  quantity: z.number(),
  markPriceUsd: z.number(),
});

export function registerPortfolioTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_set_portfolio",
    "Replace the wallet capital book with provided positions",
    {
      positions: z.array(positionInput).min(1).describe("Portfolio position rows"),
    },
    async ({ positions }) => {
      try {
        return ok(await client.setPortfolio(positions));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_clear_portfolio",
    "Clear all capital-book positions for the authenticated wallet",
    {},
    async () => {
      try {
        return ok(await client.clearPortfolio());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_sync_portfolio",
    "Replace the capital book with on-chain balances for the session wallet",
    {},
    async () => {
      try {
        return ok(await client.syncPortfolio());
      } catch (err) {
        return fail(err);
      }
    }
  );
}
