import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateExecutionReceipt } from "@buildaureon/sdk";
import { z } from "zod";
import { ok } from "./handler.js";

export function registerReceiptTools(server: McpServer) {
  server.tool(
    "aureon_validate_receipt",
    "Validates an execution receipt locally (schema + settlement honesty). No API call. Returns { valid, issues }. Do not trust or summarize a receipt as on-chain when validation fails.",
    {
      receipt: z
        .record(z.unknown())
        .describe("ExecutionReceipt JSON from restore, listExecutions, or API"),
    },
    async ({ receipt }) => {
      const result = validateExecutionReceipt(receipt);
      return ok(result);
    }
  );
}
