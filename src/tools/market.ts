import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerMarketTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_apply_market_event",
    "Apply a controlled market event to portfolio marks; optionally auto-restore",
    {
      symbol: z.string().describe("Asset symbol to shock"),
      priceChangeRatio: z.number().describe("Fractional price change (e.g. -0.15 = -15%)"),
      name: z.string().optional().describe("Event label"),
      description: z.string().optional().describe("Event description"),
      autoRestore: z.boolean().optional().describe("Run restorative execution if objectives breach"),
    },
    async (input) => {
      try {
        return ok(await client.applyMarketEvent(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_refresh_watchdog",
    "Refresh portfolio marks from live data and re-evaluate objectives",
    {},
    async () => {
      try {
        return ok(await client.refreshWatchdog());
      } catch (err) {
        return fail(err);
      }
    }
  );
}
