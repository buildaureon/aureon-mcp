import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerDriftRestoreTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_run_drift_restore_demo",
    "Run drift → detection → restore demo (seed book, break rule, manual restore)",
    {},
    async () => {
      try {
        return ok(await client.runDriftRestoreDemo());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_drift_restore_flow",
    "Read drift → detection → restore flow for active objectives",
    {
      objectiveId: z
        .string()
        .optional()
        .describe("Filter to one objective (omit for all active)"),
    },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getDriftRestoreFlow(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
