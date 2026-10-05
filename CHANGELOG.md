# Changelog

## 0.1.15

`aureon_propose_restoration` takes the sleeve id and the reserve id. It sizes unsigned `rebalance` steps from vault balances: 25% of the notional above a ceiling, then a floor step only when stables are still under the reserve after that slice. `transactionHash` and `sentBy` stay null. `automationMode: "auto"` is rejected because keeper restore can send before the steps are checked. `weightBound` is `ceiling`, `floor`, or `target`. Depends on `@buildaureon/sdk@0.1.15`. Published `@buildaureon/mcp@0.1.14` and `https://mcp.aureonlabs.network` do not include this until `0.1.15` is published and deployed.

## 0.1.14

Phase 3 financial history. SDK, MCP, and hosted MCP move together.

62 tools. New tools: `aureon_list_decisions`, `aureon_get_decision`, `aureon_get_portfolio_history`, `aureon_get_health_history`, `aureon_prepare_report`, `aureon_confirm_report`, `aureon_list_reports`, `aureon_get_report`. `aureon_list_timeline` accepts `before` and `limit`.

`aureon_ping` stays URL-only on hosted MCP. Report confirm does not broadcast. `verified` is true only when the signature recovers to the session wallet.

The API health field `version` is the API (`0.2.1` in this tree), not this package.
