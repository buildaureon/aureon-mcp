import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerFullAureonLoopTools(
  server: McpServer,
  client: AureonClient
) {
  server.tool(
    "aureon_run_full_aureon_loop_demo",
    "Run Content Arc full AUREON loop (intent → plan check → restore → receipt verification)",
    {
      brief: z
        .string()
        .optional()
        .describe(
          "User wording — default: Keep about 20% in stable assets — grow the book without abandoning the plan."
        ),
    },
    async ({ brief }) => {
      try {
        return ok(await client.runFullAureonLoopDemo({ brief }));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_full_aureon_loop_flow",
    "Read full AUREON loop for active objectives with a latest execution receipt",
    {
      objectiveId: z
        .string()
        .optional()
        .describe("Filter to one objective (omit for all active with receipts)"),
      brief: z.string().optional().describe("User brief for teaching shape"),
    },
    async ({ objectiveId, brief }) => {
      try {
        return ok(await client.getFullAureonLoopFlow({ objectiveId, brief }));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
