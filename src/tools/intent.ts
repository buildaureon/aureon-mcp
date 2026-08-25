import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

const objectiveKind = z.enum([
  "stable_allocation",
  "balanced_portfolio",
  "risk_ceiling",
  "reward_reinvestment",
]);

const objectivePriority = z.enum(["low", "medium", "high", "critical"]);

export function registerIntentTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_apply_financial_intent",
    "Register user/agent intent as an Automatic objective and return AI → objective → portfolio flow",
    {
      brief: z
        .string()
        .describe("What the user wants their money to do — agent-extracted wording"),
      kind: objectiveKind.describe("Objective kind"),
      targetWeight: z.number().describe("Target portfolio weight (0–1)"),
      tolerance: z.number().describe("Allowed drift band (0–1)"),
      targetSymbol: z
        .string()
        .optional()
        .describe("Asset symbol for balanced_portfolio (required for that kind)"),
      name: z.string().optional().describe("Objective display name override"),
      priority: objectivePriority.optional().describe("Evaluation priority"),
    },
    async (input) => {
      try {
        return ok(await client.applyFinancialIntent(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_objective_portfolio_flow",
    "Read AI → objective → portfolio flow for active objectives",
    {
      objectiveId: z
        .string()
        .optional()
        .describe("Filter to one objective (omit for all active)"),
    },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getObjectivePortfolioFlow(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
