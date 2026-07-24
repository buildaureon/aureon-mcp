import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerDeveloperTools(server: McpServer, client: AureonClient) {
  server.tool("aureon_list_api_keys", "List SDK API keys for the authenticated wallet", {}, async () => {
    try {
      return ok(await client.listApiKeys());
    } catch (err) {
      return fail(err);
    }
  });

  server.tool(
    "aureon_create_api_key",
    "Create an SDK API key (secret returned once — store immediately)",
    { name: z.string().min(2).describe("Key display name") },
    async ({ name }) => {
      try {
        return ok(await client.createApiKey(name));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_revoke_api_key",
    "Revoke (delete) an SDK API key",
    { keyId: z.string().describe("API key ID") },
    async ({ keyId }) => {
      try {
        return ok(await client.revokeApiKey(keyId));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_toggle_api_key",
    "Toggle active/paused status of an SDK API key",
    { keyId: z.string().describe("API key ID") },
    async ({ keyId }) => {
      try {
        return ok(await client.toggleApiKey(keyId));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
