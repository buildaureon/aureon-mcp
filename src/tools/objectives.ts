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

const automationMode = z.enum(["auto", "manual"]);

export function registerObjectiveTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_create_objective",
    "Create a Financial Compass Objective. targetSymbol and automationMode are locked after create — recreate to change them. Defaults to automationMode auto.",
    {
      name: z.string().describe("Objective display name"),
      kind: objectiveKind.describe("Objective kind"),
      targetWeight: z.number().describe("Target portfolio weight (0–1)"),
      tolerance: z.number().describe("Allowed drift band (0–1)"),
      priority: objectivePriority.optional().describe("Evaluation priority"),
      maxRiskScore: z.number().optional().describe("Max risk score ceiling"),
      reinvestRatio: z
        .number()
        .optional()
        .describe("Reinvest ratio for reward objectives"),
      targetSymbol: z
        .string()
        .nullable()
        .optional()
        .describe("Asset symbol to track (locked after create)"),
      automationMode: automationMode
        .optional()
        .describe("auto = keeper vault restore; manual = operator Approve (locked after create)"),
    },
    async (input) => {
      try {
        return ok(await client.createObjective(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_update_objective",
    "Partial update (name, weight, tolerance, priority). Cannot change targetSymbol or automationMode — recreate instead.",
    {
      objectiveId: z.string().describe("Objective ID"),
      name: z.string().optional(),
      priority: objectivePriority.optional(),
      targetWeight: z.number().optional(),
      tolerance: z.number().optional(),
      maxRiskScore: z.number().optional(),
      reinvestRatio: z.number().optional(),
    },
    async ({ objectiveId, ...input }) => {
      try {
        return ok(await client.updateObjective(objectiveId, input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_pause_objective",
    "Pause continuous evaluation for an objective",
    { objectiveId: z.string().describe("Objective ID") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.pauseObjective(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_resume_objective",
    "Resume evaluation for a paused objective",
    { objectiveId: z.string().describe("Objective ID") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.resumeObjective(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
