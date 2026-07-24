/**
 * @fileoverview Auth tools — wallet handshake is optional for MCP.
 *
 * Recommended path: issued AUREON_API_KEY identifies the wallet.
 * verify_wallet / dev_login update the in-process session provider when used.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AureonClient, SessionTokenProvider } from "@buildaureon/sdk";
import { z } from "zod";
import { fail, ok } from "./handler.js";

export function registerAuthTools(
  server: McpServer,
  client: AureonClient,
  session: SessionTokenProvider
) {
  server.tool(
    "aureon_get_auth_nonce",
    "Request a wallet auth nonce/message for EIP-191 signing (optional — issued API keys usually skip this)",
    { address: z.string().describe("Wallet address (0x…)") },
    async ({ address }) => {
      try {
        return ok(await client.getAuthNonce(address));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_verify_wallet",
    "Verify a wallet signature and store the Bearer session for later tools in this MCP process",
    {
      address: z.string().describe("Wallet address"),
      message: z.string().describe("Signed message from get_auth_nonce"),
      signature: z.string().describe("Wallet signature hex"),
      inviteCode: z.string().optional().describe("Invite code if required on first login"),
    },
    async ({ address, message, signature, inviteCode }) => {
      try {
        const login = await client.verifyWallet({
          address,
          message,
          signature,
          inviteCode,
        });
        session.setToken(login.token);
        return ok(login);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_dev_login",
    "Local preview login without wallet signature (requires AUREON_ALLOW_DEV_LOGIN=1 on API — not production)",
    {},
    async () => {
      try {
        const login = await client.devLogin();
        session.setToken(login.token);
        return ok(login);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_logout",
    "Revoke the current Bearer session and clear the in-process token",
    {},
    async () => {
      try {
        const result = await client.logout();
        session.clear();
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.tool(
    "aureon_me",
    "Return the wallet bound to the issued API key or current Bearer session",
    {},
    async () => {
      try {
        return ok(await client.me());
      } catch (err) {
        return fail(err);
      }
    }
  );
}
