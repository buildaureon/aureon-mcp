/**
 * @fileoverview MCP process configuration from environment.
 *
 * Prefer an **issued** developer API key from the Operator Console (Developers page).
 * That key identifies the bound wallet for control-plane tools — no Bearer required.
 * `AUREON_AUTH_TOKEN` is optional (utility-style session, or when using env bootstrap keys).
 */

import { DEFAULT_API_BASE_URL } from "@buildaureon/sdk";

export interface McpConfig {
  apiUrl: string;
  apiKey: string | undefined;
  authToken: string | undefined;
}

export function loadConfig(): McpConfig {
  const apiUrl = process.env.AUREON_API_URL || DEFAULT_API_BASE_URL;
  const apiKey = process.env.AUREON_API_KEY || undefined;
  const authToken = process.env.AUREON_AUTH_TOKEN || undefined;

  if (!apiKey && !authToken) {
    throw new Error(
      "Set AUREON_API_KEY (issued developer key from app.aureonlabs.network Developers) " +
        "or AUREON_AUTH_TOKEN (wallet Bearer). " +
        "See https://github.com/buildaureon/aureon-mcp#authentication"
    );
  }

  return { apiUrl, apiKey, authToken };
}
