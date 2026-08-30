import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

const agentHost = z.enum(["cursor", "claude", "mcp"]);

export function registerPortfolioWatchTools(
  server: McpServer,
  client: AureonClient
) {
  server.tool(
    "aureon_run_portfolio_watch_demo",
    "Run portfolio watch demo (brief → Automatic objective → while-away event → return briefing)",
    {
      brief: z
        .string()
        .optional()
        .describe(
          "User wording — default: Watch my portfolio while I'm away — keep about 20% in stable assets."
        ),
      host: agentHost
        .optional()
        .describe("Agent host label for briefing (cursor | claude | mcp)"),
    },
    async ({ brief, host }) => {
      try {
        return ok(await client.runPortfolioWatchDemo({ brief, host }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_portfolio_watch_flow",
    "Read portfolio watch briefing for Automatic objectives",
    {
      objectiveId: z
        .string()
        .optional()
        .describe("Filter to one objective (omit for all Automatic)"),
      brief: z.string().optional().describe("User brief for briefing lines"),
      host: agentHost.optional().describe("Agent host label"),
    },
    async ({ objectiveId, brief, host }) => {
      try {
        return ok(
          await client.getPortfolioWatchFlow({ objectiveId, brief, host })
        );
      } catch (err) {
        return fail(err);
      }
    }
  );
}
