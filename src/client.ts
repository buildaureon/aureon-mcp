/**
 * @fileoverview Builds the shared AureonClient for MCP tool handlers.
 */

import {
  createAureonClient,
  createSessionTokenProvider,
  type AureonClient,
  type SessionTokenProvider,
} from "@buildaureon/sdk";
import type { McpConfig } from "./config.js";

export type McpClientBundle = {
  client: AureonClient;
  session: SessionTokenProvider;
};

export function createClient(config: McpConfig): McpClientBundle {
  const session = createSessionTokenProvider(config.authToken ?? null);
  const client = createAureonClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey ?? null,
    getAccessToken: session.getAccessToken,
  });
  return { client, session };
}
