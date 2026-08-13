import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerRegistryTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_registry_status",
    "Returns Phase 2 ObjectiveRegistry deployment status (testnet contract address when configured).",
    {},
    async () => {
      try {
        return ok(await client.getRegistryStatus());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_objective_registry",
    "Returns the on-chain registry record for an objective when registered.",
    {
      objectiveId: z.string().describe("Objective id"),
    },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getObjectiveRegistry(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_prepare_objective_registry",
    "Prepares wallet-signed calldata to register an objective on ObjectiveRegistry. The host wallet must broadcast the tx, then call confirm via SDK.",
    {
      objectiveId: z.string().describe("Objective id to register on-chain"),
    },
    async ({ objectiveId }) => {
      try {
        return ok(await client.prepareObjectiveRegistry(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
