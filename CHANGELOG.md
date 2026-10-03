# Changelog

## 0.1.14

Phase 3 financial history. SDK, MCP, and hosted MCP move together.

62 tools. New tools: `aureon_list_decisions`, `aureon_get_decision`, `aureon_get_portfolio_history`, `aureon_get_health_history`, `aureon_prepare_report`, `aureon_confirm_report`, `aureon_list_reports`, `aureon_get_report`. `aureon_list_timeline` accepts `before` and `limit`.

`aureon_ping` stays URL-only on hosted MCP. Report confirm does not broadcast. `verified` is true only when the signature recovers to the session wallet.

The API health field `version` is the API (`0.2.1` in this tree), not this package.
