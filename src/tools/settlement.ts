import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerSettlementTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_get_execution_settlement",
    "Returns the chain-verified settlement record for a vault execution when the listener has observed an on-chain Rebalanced event. Staged executions never have settlement records — do not claim on-chain proof without this.",
    {
      executionId: z.string().describe("Execution receipt id"),
    },
    async ({ executionId }) => {
      try {
        return ok(await client.getExecutionSettlement(executionId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_list_settlements",
    "Lists chain-verified settlement records for the authenticated wallet. Optional objectiveId filter.",
    {
      objectiveId: z.string().optional().describe("Filter by objective id"),
    },
    async ({ objectiveId }) => {
      try {
        return ok({ settlements: await client.listSettlements(objectiveId) });
      } catch (err) {
        return fail(err);
      }
    }
  );
}
