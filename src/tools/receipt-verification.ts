import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerReceiptVerificationTools(
  server: McpServer,
  client: AureonClient
) {
  server.tool(
    "aureon_run_receipt_verification_demo",
    "Run receipt → verification demo (restore + validate receipt + settlement lookup)",
    {},
    async () => {
      try {
        return ok(await client.runReceiptVerificationDemo());
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_get_receipt_verification_flow",
    "Read receipt → verification flow for execution receipts",
    {
      executionId: z
        .string()
        .optional()
        .describe("Filter to one execution id (omit for five most recent)"),
    },
    async ({ executionId }) => {
      try {
        return ok(await client.getReceiptVerificationFlow(executionId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
