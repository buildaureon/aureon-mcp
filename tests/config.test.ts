/**
 * @fileoverview MCP loadConfig network resolution.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { MAINNET_API_BASE_URL, TESTNET_API_BASE_URL } from "@buildaureon/sdk";
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

test("MCP default network is mainnet 8788", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_API_URL: undefined,
      AUREON_NETWORK: undefined,
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.network, "mainnet");
      assert.equal(cfg.apiUrl, MAINNET_API_BASE_URL);
      assert.equal(cfg.chainId, 4663);
    }
  );
});

test("MCP AUREON_NETWORK=testnet uses public host", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_API_URL: undefined,
      AUREON_NETWORK: "testnet",
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.network, "testnet");
      assert.equal(cfg.apiUrl, TESTNET_API_BASE_URL);
      assert.equal(cfg.chainId, 46630);
    }
  );
});

test("MCP AUREON_API_URL still overrides when it matches", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_NETWORK: "testnet",
      AUREON_API_URL: TESTNET_API_BASE_URL,
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.apiUrl, TESTNET_API_BASE_URL);
      assert.equal(cfg.network, "testnet");
    }
  );
});

test("MCP mismatch AUREON_NETWORK=mainnet + public URL throws", () => {
  withEnv(
    {
      AUREON_API_KEY: "test-key",
      AUREON_NETWORK: "mainnet",
      AUREON_API_URL: TESTNET_API_BASE_URL,
      AUREON_AUTH_TOKEN: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /does not match network/);
    }
  );
});
