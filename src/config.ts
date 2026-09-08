/**
 * @fileoverview MCP process configuration from environment.
 *
 * Prefer an **issued** developer API key from the Operator Console (Developers page).
 * That key identifies the bound wallet for control-plane tools — no Bearer required.
 * `AUREON_AUTH_TOKEN` is optional (utility-style session, or when using env bootstrap keys).
 *
 * Default API is https://api.aureonlabs.network. Optional `AUREON_NETWORK`
 * selects chain (`testnet` 46630 by default, or `mainnet` 4663).
 * `AUREON_API_URL` overrides the official host when set.
 */

import {
  resolveAureonNetworkFromEnv,
  type AureonNetwork,
} from "@buildaureon/sdk";

export interface McpConfig {
  apiUrl: string;
  apiKey: string | undefined;
  authToken: string | undefined;
  network: AureonNetwork;
  chainId: number;
}

export function loadConfig(): McpConfig {
  const resolved = resolveAureonNetworkFromEnv();
  const apiKey = process.env.AUREON_API_KEY || undefined;
  const authToken = process.env.AUREON_AUTH_TOKEN || undefined;

  if (!apiKey && !authToken) {
    throw new Error(
      "Set AUREON_API_KEY (issued developer key) " +
        "or AUREON_AUTH_TOKEN (wallet Bearer). " +
        "Default API is https://api.aureonlabs.network. " +
        "See https://github.com/buildaureon/aureon-mcp#authentication"
    );
  }

  return {
    apiUrl: resolved.baseUrl,
    apiKey,
    authToken,
    network: resolved.network,
    chainId: resolved.chainId,
  };
}
