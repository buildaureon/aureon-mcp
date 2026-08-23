import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerCompassTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_get_restore_plan",
    "Restore plan for an objective — proposed rebalance steps to return to policy",
    { objectiveId: z.string().describe("The objective ID") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getRestorePlan(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_run_execution",
    "Run restorative execution for an objective outside policy. Read receipt.settlement and receipt.verifiedOnChain — staged = never on-chain; vault + verifiedOnChain = chain-observed; vault without verified = submitted but not yet observed.",
    { objectiveId: z.string().describe("The objective ID") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.runExecution(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_restore_objective",
    "Run vault-backed restorative execution for an objective outside policy. Returns ExecutionReceipt with settlement, verifiedOnChain, optional settlementRecord, explorerUrl, registryRef.",
    { objectiveId: z.string().describe("The objective ID") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.restoreObjective(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_list_executions",
    "Recent execution receipts — read settlement, verifiedOnChain, settlementRecord, explorerUrl, registryRef.",
    { objectiveId: z.string().optional().describe("Filter by objective ID (omit for all)") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.listExecutions(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
