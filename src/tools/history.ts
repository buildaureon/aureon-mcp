import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerHistoryTools(server: McpServer, client: AureonClient) {
  server.tool(
    "aureon_list_decisions",
    "Decision records for objective set, change, pause, and resume",
    {
      objectiveId: z.string().optional().describe("Limit to one objective"),
    },
    async ({ objectiveId }) => {
      try {
        return ok(await client.listDecisions(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_decision",
    "One decision record by id",
    { id: z.string().describe("Decision id") },
    async ({ id }) => {
      try {
        return ok(await client.getDecision(id));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_portfolio_history",
    "Stored daily portfolio totals for this wallet",
    {},
    async () => {
      try {
        return ok(await client.getPortfolioHistory());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_health_history",
    "Stored health score samples for this wallet",
    {},
    async () => {
      try {
        return ok(await client.getHealthHistory());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_prepare_report",
    "Build a financial report from stored rows and return the message to sign. Does not broadcast.",
    { objectiveId: z.string().describe("Objective id") },
    async ({ objectiveId }) => {
      try {
        return ok(await client.prepareReport(objectiveId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_confirm_report",
    "Store a wallet signature for a prepared report. Verified only when the signature recovers to the session wallet. Does not broadcast.",
    {
      reportId: z.string().describe("Report id from prepare"),
      message: z.string().describe("Exact message returned by prepare"),
      signature: z.string().describe("Wallet signature of that message"),
    },
    async (input) => {
      try {
        return ok(await client.confirmReport(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_list_reports",
    "Stored financial reports for this wallet",
    {},
    async () => {
      try {
        return ok(await client.listReports());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_report",
    "One stored financial report",
    { id: z.string().describe("Report id") },
    async ({ id }) => {
      try {
        return ok(await client.getReport(id));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
