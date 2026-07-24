import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerReadTools(server: McpServer, client: AureonClient) {
  server.tool("aureon_ping", "Health probe — confirms API connectivity", {}, async () => {
    try {
      return ok(await client.ping());
    } catch (err) {
      return fail(err);
    }
  });

  server.tool(
    "aureon_get_overview",
    "Dashboard overview — total AUM, objective count, aggregate health",
    {},
    async () => {
      try {
        return ok(await client.getOverview());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_portfolio",
    "Current capital book snapshot — positions, marks, weights",
    {},
    async () => {
      try {
        return ok(await client.getPortfolio());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool("aureon_list_objectives", "List all Financial Compass Objectives", {}, async () => {
    try {
      return ok(await client.listObjectives());
    } catch (err) {
      return fail(err);
    }
  });

  server.tool(
    "aureon_get_objective",
    "Get a single objective by ID",
    { objectiveId: z.string().describe("The objective ID") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getObjective(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_health",
    "Health state for objectives — drift, breach status, policy compliance",
    { objectiveId: z.string().optional().describe("Filter by objective ID (omit for all)") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getHealth(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_list_timeline",
    "Timeline of events — objective changes, executions, health transitions",
    { objectiveId: z.string().optional().describe("Filter by objective ID (omit for all)") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.getTimeline(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_list_market_presets",
    "Available market event simulation presets",
    {},
    async () => {
      try {
        return ok(await client.listMarketPresets());
      } catch (err) {
        return fail(err);
      }
    }
  );
}
