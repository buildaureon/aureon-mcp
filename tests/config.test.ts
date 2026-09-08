/**
 * @fileoverview MCP loadConfig official API default.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OFFICIAL_API_BASE_URL } from "@buildaureon/sdk";
import { loadConfig } from "../src/config.js";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void
) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const prev = previous[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  }
}

test("MCP default is the official API / testnet 46630", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_API_URL: undefined,
      AUREON_NETWORK: undefined,
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.network, "testnet");
      assert.equal(cfg.apiUrl, OFFICIAL_API_BASE_URL);
      assert.equal(cfg.chainId, 46630);
    }
  );
});

test("MCP AUREON_NETWORK=mainnet keeps the official API", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_API_URL: undefined,
      AUREON_NETWORK: "mainnet",
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.network, "mainnet");
      assert.equal(cfg.apiUrl, OFFICIAL_API_BASE_URL);
      assert.equal(cfg.chainId, 4663);
    }
  );
});

test("MCP official URL is allowed with either network", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_NETWORK: "mainnet",
      AUREON_API_URL: OFFICIAL_API_BASE_URL,
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.apiUrl, OFFICIAL_API_BASE_URL);
      assert.equal(cfg.network, "mainnet");
    }
  );
});
