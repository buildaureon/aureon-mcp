import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerAuditTrailTools(
  server: McpServer,
  client: AureonClient
) {
  server.tool(
    "aureon_get_audit_trail",
    "Export the financial audit trail for one objective: registry, receipts, settlements, timeline. Missing proof is labeled. Never invent on-chain claims.",
    {
      objectiveId: z.string().describe("Objective id to export"),
    },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getAuditTrail(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
