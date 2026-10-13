# Changelog

Dates are the npm publish day, except `0.1.16`, which is this tree and is not on npm yet. The API `/healthz` field `version` is the API. It is not this package version.

## 0.1.16 — 2026-10-12

Hire check and restoration confirm. `@buildaureon/mcp` `0.1.16`, `@buildaureon/sdk` `0.1.16`, and hosted MCP `0.1.16` move together.

Depends on `@buildaureon/sdk@0.1.16` from npm, not a local folder. npm still serves `0.1.15`, published 2026-10-06. Publish the SDK first, then this package.

### Tool surface

This build registers **66 tools**. Stdio and hosted MCP in this tree use the same catalog.

Names added since `0.1.15` (63 tools):

- `aureon_check_policy`
- `aureon_get_policy_check`
- `aureon_confirm_restoration`

Open without a key, on hosted MCP only: `aureon_ping` and `aureon_validate_receipt`. `aureon_list_market_presets` needs an issued key. Stdio uses `AUREON_API_KEY` for the wallet tools.

### Hire check

`aureon_check_policy` reads one financial objective and stores `allow`, `refuse`, or `authorization_required`. `aureon_get_policy_check` reads that stored decision by `actionId`. Create accepts `hireLimitEth` and `hireApprovalRequired`.

The cap stays `hireLimitEth`. `action.asset` is `ETH`, or `SOL` priced as an ETH equivalent.

- An ETH amount is compared with the cap directly.
- A SOL amount is converted in the API before that comparison: `SOL × (SOL_USD / ETH_USD)`, rounded up with `(sol × solUsd + ethUsd − 1) / ethUsd`. The marks come from the live USD feed. A missing SOL price stores `refuse` with "SOL price is unavailable." A missing ETH price stores `refuse` with "ETH price is unavailable." The check does not invent a rate.
- Any other asset stores `refuse`: "Only ETH, or SOL as an ETH equivalent, can be hired."
- Equal to the cap is inside. ETH allow reason: "Hire is inside the ETH limit." SOL allow reason: "SOL equivalent is inside the ETH hire limit."
- Above the cap is `refuse`, including when approval is also required. SOL over the cap: "SOL equivalent is above the ETH hire limit."
- Inside the cap with `hireApprovalRequired` is `authorization_required`, and `policy.passed` is false.
- A missing objective is not stored.

The tool sends the asset string. The API does the conversion. The check does not pay, does not sign, and does not send. SOL in this check is that asset symbol. The call does not build a Solana transaction.

`0.1.15` had no hire tool.

### Restoration

`aureon_propose_restoration` is the unsigned sleeve and reserve proposal from `0.1.15`. The sleeve step sells `profitTakeRatio` of the notional above a ceiling. The reserve step runs only when stables are still under the floor after that slice. `transactionHash` and `sentBy` stay null. Both objectives are `manual`.

`aureon_confirm_restoration` takes `objectiveId` and `transactionHash`. It stores a vault rebalance the session wallet already broadcast. The API checks the receipt: the transaction succeeded, the sender is the session wallet, `to` is the vault, and the calldata is the rebalance. It then stores a confirmed execution. This tool does not sign and does not broadcast.

`aureon_restore_objective` and `aureon_run_execution` are different tools. On an `auto` objective the keeper can still send before the steps are checked. `aureon_confirm_execution_settlement` confirms settlement on an existing execution. It is a separate tool from `aureon_confirm_restoration`.

### Versions

This package is `0.1.16`. The API `/healthz` field `version` in this tree is `0.2.2`. Hosted health in this tree returns `tools: 66`. The public host returns that count after this build is deployed.

## 0.1.15 — 2026-10-06

Unsigned restoration. Published to npm on this day. Depends on `@buildaureon/sdk@0.1.15`, also published 2026-10-06.

### Tool surface

**63 tools.** The name added in this release is `aureon_propose_restoration`. `0.1.14` had 62 tools.

`aureon_ping` stayed URL-only on hosted MCP. The hire tools and `aureon_confirm_restoration` were not in this publish.

### Restoration

`aureon_propose_restoration` takes the sleeve id and the reserve id. It sizes unsigned `rebalance` steps from vault balances.

- The sleeve step sells `profitTakeRatio` of the notional above a ceiling. With `profitTakeRatio: 0.25`, that is 25% of the value above the cap, not a full return to the cap.
- The reserve step runs only when stables are still under the floor after that slice.
- `weightBound` is `ceiling`, `floor`, or `target`.
- `transactionHash` and `sentBy` stay null. The tool does not sign and does not broadcast.
- `automationMode: "auto"` is rejected because keeper restore can send before the steps are checked.

## 0.1.14 — 2026-10-03

Financial history. Published to npm on this day. SDK, MCP, and hosted MCP moved together. The API health field `version` at this release was `0.2.1`.

### Tool surface

**62 tools.** Names added in this release:

- `aureon_list_decisions`
- `aureon_get_decision`
- `aureon_get_portfolio_history`
- `aureon_get_health_history`
- `aureon_prepare_report`
- `aureon_confirm_report`
- `aureon_list_reports`
- `aureon_get_report`

`aureon_list_timeline` accepts `before` and `limit`.

`aureon_ping` stays URL-only on hosted MCP. `aureon_confirm_report` does not broadcast. `verified` is true only when the signature recovers to the session wallet.
