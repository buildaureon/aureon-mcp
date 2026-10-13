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
    "aureon_propose_restoration",
    "Unsigned restoration from vault balances for the sleeve cap and the stable reserve floor. Returns to, data, and value for each step. Does not sign or broadcast. Both objectives must be manual. A full return to the sleeve cap is not the profit slice.",
    {
      sleeveObjectiveId: z.string().describe("risk_ceiling objective id with weightBound ceiling"),
      reserveObjectiveId: z.string().describe("stable_allocation objective id with weightBound floor"),
    },
    async ({ sleeveObjectiveId, reserveObjectiveId }) => {
      try {
        return ok(await client.proposeRestoration({ sleeveObjectiveId, reserveObjectiveId }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_confirm_restoration",
    "Store a vault rebalance the session wallet already broadcast. Checks the receipt. Does not sign or broadcast.",
    {
      objectiveId: z.string().describe("Objective id the rebalance belongs to"),
      transactionHash: z.string().describe("32-byte transaction hash from the wallet broadcast"),
    },
    async ({ objectiveId, transactionHash }) => {
      try {
        return ok(await client.confirmRestoration(objectiveId, transactionHash));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_check_policy",
    "Check one proposed agent hire against the wallet's financial objective. Returns allow, refuse, or authorization_required. Does not send the hire and does not sign.",
    {
      agentId: z.string().describe("Calling agent id"),
      taskId: z.string().describe("Task id for this hire"),
      objectiveId: z.string().describe("AUREON objective id owned by this wallet"),
      action: z
        .object({
          type: z.string().describe("Must be hire"),
          asset: z.string().describe("ETH, or SOL priced as an ETH equivalent"),
          amount: z.string().describe("Positive decimal in that asset"),
          agent: z.string().describe("Agent being paid"),
        })
        .describe("Proposed hire"),
    },
    async (input) => {
      try {
        return ok(await client.checkPolicy(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_policy_check",
    "Read one stored hire decision by actionId. Does not send the hire and does not sign.",
    { actionId: z.string().describe("Stored policy action id") },
    async ({ actionId }) => {
      try {
        return ok(await client.getPolicyCheck(actionId));
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
    "Run restorative execution for an objective outside policy. Not always vault-backed: read settlement and verifiedOnChain. staged is never on-chain. vault without verifiedOnChain is submitted, not proven. Returns ExecutionReceipt.",
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
