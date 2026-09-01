# AUREON MCP Tool Reference

Complete reference for every tool exposed by `@buildaureon/mcp`.

Each tool maps to one public method on the `@buildaureon/sdk` client. Handlers validate arguments, call the live AUREON API, and return pretty-printed JSON (or an agent-readable error envelope).

For request/response shapes, error codes, and HTTP contracts, see the **@buildaureon/sdk documentation**.

**Tool count:** 52.

**API:** `https://api.aureonlabs.network` (Robinhood Chain L2, early access).

---

## Conventions

These conventions apply to every tool below.

| Convention | Meaning |
| --- | --- |
| Issued API key | Set `AUREON_API_KEY` to an issued Developers key. That key is product access **and** wallet identity for control-plane calls. |
| Optional Bearer | You may also supply a wallet Bearer (`AUREON_AUTH_TOKEN` or `aureon_verify_wallet`). If both key and Bearer are present, Bearer wins. |
| Live API only | Tools talk to the live AUREON gateway. There is no local-backend mode for agents. |
| Private key outside MCP | Deposit and withdraw **prepare** tools return unsigned steps. Signing and broadcast happen in the host wallet — never inside the MCP process. |
| Default automation | `aureon_create_objective` defaults `automationMode` to `"auto"`. |
| Locked at create | `targetSymbol` and `automationMode` are immutable after create. Recreate the objective to change them. |
| Unsigned prepare | `aureon_prepare_vault_deposit` and `aureon_prepare_vault_withdraw` never broadcast. |
| Settlement honesty | Restore / execution receipts may show `settlement: "vault"` (on-chain) or `"staged"` (ledger-local). Label them honestly. |

The catalog includes `aureon_dev_login` for preview APIs only. On the live production API it fails by design — agents should use an issued key (or optional Bearer) instead.

### Auth bootstrap (agents)

1. Create an issued key in the operator utility **Developers** console.
2. Configure the MCP host with `AUREON_API_URL=https://api.aureonlabs.network` and `AUREON_API_KEY`.
3. Call tools. Day-to-day agent work does **not** require a wallet handshake.

Optional wallet path: `aureon_get_auth_nonce` → host signs → `aureon_verify_wallet`. Prefer issued keys for always-on agents.

### Response shape

Successful calls return structured JSON (formatted for agents). Failures return an error object with a stable code and message — see the **@buildaureon/sdk documentation** error model.

### Quick index

| Group | Tools |
| --- | --- |
| Health | `aureon_ping` |
| Auth & identity | `aureon_get_auth_nonce`, `aureon_verify_wallet`, `aureon_dev_login`, `aureon_logout`, `aureon_me` |
| Dashboard & read | `aureon_get_overview`, `aureon_get_allocation_vs_target`, `aureon_get_objective_portfolio_flow`, `aureon_get_drift_restore_flow`, `aureon_get_receipt_verification_flow`, `aureon_get_portfolio_watch_flow`, `aureon_get_full_aureon_loop_flow`, `aureon_get_portfolio`, `aureon_list_objectives`, `aureon_get_objective`, `aureon_get_health`, `aureon_list_timeline`, `aureon_list_market_presets`, `aureon_get_restore_plan`, `aureon_list_executions`, `aureon_get_vault`, `aureon_get_vault_status` |
| Objectives | `aureon_create_objective`, `aureon_apply_financial_intent`, `aureon_run_drift_restore_demo`, `aureon_run_receipt_verification_demo`, `aureon_run_portfolio_watch_demo`, `aureon_run_full_aureon_loop_demo`, `aureon_update_objective`, `aureon_pause_objective`, `aureon_resume_objective` |
| Portfolio write | `aureon_set_portfolio`, `aureon_clear_portfolio`, `aureon_sync_portfolio` |
| Execution | `aureon_run_execution`, `aureon_restore_objective` |
| Market | `aureon_apply_market_event`, `aureon_refresh_watchdog` |
| Vault prepare | `aureon_prepare_vault_deposit`, `aureon_prepare_vault_withdraw` |
| Developer keys | `aureon_list_api_keys`, `aureon_create_api_key`, `aureon_revoke_api_key`, `aureon_toggle_api_key` |

---

## Health

### `aureon_ping`

**Purpose:** Confirm the live API is reachable and return a lightweight service / version smoke payload.

**Typical args:** none.

**When to use:** First call in a session; connectivity checks; before diagnosing auth or policy failures.

**Caveats:** A successful ping does not prove the issued key is valid for wallet-scoped tools — follow with `aureon_me` when identity matters.

---

## Auth & identity

### `aureon_get_auth_nonce`

**Purpose:** Fetch an EIP-191 challenge message for a wallet address so the host can sign a Bearer login.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `address` | yes | Wallet `0x…` |

**When to use:** Optional wallet handshake only. Issued API keys usually skip this path.

**Caveats:** The message must be signed by the matching wallet. Early-access wallets may still need an invite on verify.

### `aureon_verify_wallet`

**Purpose:** Exchange a signed nonce for a Bearer session and store it in-process for later tools in this MCP session.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `address` | yes | Same wallet as the nonce |
| `message` | yes | From `aureon_get_auth_nonce` |
| `signature` | yes | Wallet signature hex |
| `inviteCode` | no | First-login invite when required |

**When to use:** When you intentionally want a Bearer session instead of (or in addition to) an issued key.

**Caveats:** Bearer wins over the API key when both are present. Do not ask the user for a private key — only a signature over the challenge.

### `aureon_dev_login`

**Purpose:** Preview-API shortcut that returns a Bearer session without a wallet signature.

**Typical args:** none.

**When to use:** Only on a preview / staging API that explicitly enables `AUREON_ALLOW_DEV_LOGIN=1`.

**Caveats:** Fails on `https://api.aureonlabs.network`. Do not put this tool in production agent playbooks. Prefer issued keys.

### `aureon_logout`

**Purpose:** Revoke the current Bearer session and clear the in-process token.

**Typical args:** none.

**When to use:** End a wallet session; rotate away from a Bearer after debugging.

**Caveats:** Does not revoke the issued `AUREON_API_KEY`. Key-only agents may not need this tool.

### `aureon_me`

**Purpose:** Return the wallet bound to the issued API key or the current Bearer session.

**Typical args:** none.

**When to use:** Identity confirmation after connect; every morning check; before mutating portfolio or objectives.

**Caveats:** If you see an error about env keys that cannot identify a wallet, replace the key with an **issued** Developers key.

---

## Dashboard & portfolio (read)

### `aureon_get_overview`

**Purpose:** Dashboard rollup — AUM, objective counts, aggregate health posture.

**Typical args:** none.

**When to use:** Morning checks; high-level status before diving into a single objective.

**Caveats:** Overview is a summary. Drill into `aureon_get_health` / `aureon_get_objective` for policy decisions.

### `aureon_get_allocation_vs_target`

**Purpose:** Objective vs actual portfolio — current weight vs policy target per active objective, plus a green-book/off-plan paradox flag.

**Typical args:** none.

**When to use:** demos; explain when the book is up but objectives are in warning/violation; avoid stitching overview + health manually.

**Returns:** `{ rows, paradox, overview }` — see `@buildaureon/sdk` `getAllocationVsTarget()`.

**Caveats:** Paradox detection uses 24h book change when available. Pair with `aureon_apply_market_event` (`autoRestore: false`) for rehearsal demos.

### `aureon_get_objective_portfolio_flow`

**Purpose:** Read AI → objective → portfolio flow for active objectives (intent summary, objective, health, portfolio snapshot).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Filter to one objective; omit for all active |

**When to use:** — confirm intent is linked to live portfolio after `aureon_apply_financial_intent`; read-only refresh without creating a new objective.

**Returns:** Array of flow objects — see `@buildaureon/sdk` `getObjectivePortfolioFlow()`.

**Caveats:** Only active objectives are included. Pair with `aureon_get_allocation_vs_target` for ongoing objective vs actual tracking.

### `aureon_run_drift_restore_demo`

**Purpose:** Run drift → detection → restore demo in one call (seed book, create stable objective, NVDA rally with `autoRestore: false`, manual restore).

**Typical args:** none.

**When to use:** Content Arc Day 4; teach the full loop without stitching portfolio, market, plan, and restore tools.

**Returns:** `DriftRestoreFlow` — see `@buildaureon/sdk` `runDriftRestoreDemo()`.

**Caveats:** Mutates portfolio and creates a new objective. Settlement may be `vault` or `staged`. Controlled rehearsal — not discretionary trading.

### `aureon_get_drift_restore_flow`

**Purpose:** Read drift → detection → restore flow for active objectives (health, allocation row, restore plan when off-plan, latest receipt).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Filter to one objective; omit for all active |

**When to use:** Confirm three-beat arc after manual steps in workflow J; read-only monitoring.

**Returns:** Array of `DriftRestoreFlow` — see `@buildaureon/sdk` `getDriftRestoreFlow()`.

**Caveats:** Inferred phases when historical aligned/drift snapshots are not stored; pair with `aureon_list_timeline` for audit trail.

### `aureon_run_receipt_verification_demo`

**Purpose:** Run receipt → verification demo (drift-restore + validate receipt + settlement lookup + timeline).

**Typical args:** none.

**When to use:** Content Arc Day 5; teach claim vs validation vs chain proof without stitching restore, validate, and settlement tools.

**Returns:** `ReceiptVerificationFlow` — see `@buildaureon/sdk` `runReceiptVerificationDemo()`.

**Caveats:** Mutates portfolio via embedded drift-restore. Validator is local — does not re-query chain. Staged receipts validate but are not chain-verified.

### `aureon_get_receipt_verification_flow`

**Purpose:** Read receipt → verification flow for execution receipts (claim, validation result, settlement lookup, timeline).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `executionId` | no | Filter to one execution; omit for five most recent |

**When to use:** Confirm verification tier after manual steps in workflow K.

**Returns:** Array of `ReceiptVerificationFlow` — see `@buildaureon/sdk` `getReceiptVerificationFlow()`.

**Caveats:** Pair with `aureon_validate_receipt` for local checks; use `aureon_get_execution_settlement` for vault chain proof.

### `aureon_run_portfolio_watch_demo`

**Purpose:** Run portfolio watch demo (brief → Automatic objective → while-away market event with auto restore → return briefing).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `brief` | no | User wording; default watch-while-away brief |
| `host` | no | `cursor` \| `claude` \| `mcp` for briefing labels |

**When to use:** Content Arc Day 6; Claude/Cursor + AUREON agent-in-host teaching.

**Returns:** `PortfolioWatchFlow` — see `@buildaureon/sdk` `runPortfolioWatchDemo()`.

**Caveats:** Mutates portfolio and objectives. Uses `autoRestore: true`. Not unsupervised trading — registered Automatic policy only.

### `aureon_get_portfolio_watch_flow`

**Purpose:** Read portfolio watch briefing for Automatic objectives.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Filter to one objective |
| `brief` | no | User brief for summary lines |
| `host` | no | Agent host label |

**When to use:** Confirm briefing after manual steps in workflow L.

**Returns:** Array of `PortfolioWatchFlow` — see `@buildaureon/sdk` `getPortfolioWatchFlow()`.

### `aureon_run_full_aureon_loop_demo`

**Purpose:** Run Content Arc full AUREON loop (intent → plan check with autoRestore false → restore → receipt verification).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `brief` | no | User wording; default full-loop brief |

**When to use:** Content Arc Day 7; positioning demo — not a portfolio tracker.

**Returns:** `FullAureonLoopFlow` — see `@buildaureon/sdk` `runFullAureonLoopDemo()`.

**Caveats:** Mutates portfolio. Uses `autoRestore: false` then manual restore. Staged receipts validate but are not chain-verified.

### `aureon_get_full_aureon_loop_flow`

**Purpose:** Read full AUREON loop for active objectives that already have an execution receipt.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Filter to one objective |
| `brief` | no | User brief for teaching shape |

**When to use:** Confirm closed loop after manual steps in workflow M.

**Returns:** Array of `FullAureonLoopFlow` — see `@buildaureon/sdk` `getFullAureonLoopFlow()`.

### `aureon_get_portfolio`

**Purpose:** Current Capital Book snapshot — positions, marks, and weights.

**Typical args:** none.

**When to use:** After sync; before creating objectives; when explaining current exposure.

**Caveats:** Stale books mislead restore logic. Prefer `aureon_sync_portfolio` when chain balances may have changed.

### `aureon_list_objectives`

**Purpose:** List all Financial Compass objectives for the authenticated wallet.

**Typical args:** none.

**When to use:** Discover IDs; inventory auto vs paused objectives; pick a target for restore.

**Caveats:** Empty list is normal for new wallets. Create with `automationMode: "auto"` for agent-driven restores.

### `aureon_get_objective`

**Purpose:** Fetch one objective by ID (policy fields, status, locked create-time fields).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | yes | From list or create |

**When to use:** Inspect before update / pause / restore; confirm `targetSymbol` and `automationMode`.

**Caveats:** Remember `targetSymbol` and `automationMode` cannot be patched later.

### `aureon_get_health`

**Purpose:** Health / drift / breach state for one objective or all objectives.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Omit for all |

**When to use:** After watchdog refresh; before restore; when the operator asks why something looks red.

**Caveats:** Health can flap after marks update. Re-read after restore instead of spamming restores.

### `aureon_list_timeline`

**Purpose:** Event timeline — objective changes, executions, health transitions.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Omit for all |

**When to use:** Post-restore confirmation; audit trail for the operator; debugging unexpected state.

**Caveats:** Timeline is historical context, not a substitute for the latest health snapshot.

### `aureon_list_market_presets`

**Purpose:** List available market-event simulation presets for rehearsal.

**Typical args:** none.

**When to use:** Before `aureon_apply_market_event` in integration / demo flows.

**Caveats:** Presets are for rehearsal, not live oracle prices.

### `aureon_get_restore_plan`

**Purpose:** Inspect the proposed restore plan for an objective (steps to return to policy).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | yes | Target objective |

**When to use:** Always prefer reading the plan before `aureon_restore_objective` when explaining risk to a human.

**Caveats:** Plans can change after marks or vault balances move. Refresh health / watchdog if the book is stale.

### `aureon_list_executions`

**Purpose:** Recent execution receipts for restorative actions.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | no | Omit for all |

**When to use:** Confirm last restore; check `settlement` field (`vault` vs `staged`).

**Caveats:** Never claim on-chain settlement unless the receipt says `settlement: "vault"`.

### `aureon_get_vault`

**Purpose:** Full vault overview — balances, tokens, deposit-related history.

**Typical args:** none.

**When to use:** Funding diagnosis; after a broadcasted deposit; capital readiness reviews.

**Caveats:** Vault overview can lag until chain txs confirm and portfolio sync runs.

### `aureon_get_vault_status`

**Purpose:** Compact funding / readiness status before Automatic restores.

**Typical args:** none.

**When to use:** Morning checks; gate before creating auto objectives; after prepare+broadcast deposits.

**Caveats:** Empty vault often blocks meaningful Automatic restores — prepare a deposit and have the host sign.

---

## Portfolio (write)

### `aureon_set_portfolio`

**Purpose:** Replace the Capital Book with an explicit position list.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `positions` | yes | Array of rows: `symbol`, `name`, `category`, `quantity`, `markPriceUsd` |
| `positions[].category` | yes | `stable` \| `stock_token` \| `gas` \| `other` |

**When to use:** Controlled demos or explicit book overrides when the operator supplies positions.

**Caveats:** Overwrites the book. Prefer `aureon_sync_portfolio` for live chain marks in production agent loops.

### `aureon_clear_portfolio`

**Purpose:** Clear all Capital Book positions for the authenticated wallet.

**Typical args:** none.

**When to use:** Reset before a clean sync or demo restart.

**Caveats:** Destructive. Confirm with the operator before clearing a live book.

### `aureon_sync_portfolio`

**Purpose:** Replace the Capital Book with on-chain balances for the session wallet.

**Typical args:** none.

**When to use:** Default read-path refresh; after deposits/withdraws broadcast; before create / restore.

**Caveats:** Sync does not move vault funds by itself — it refreshes the book the policy engine reads.

---

## Objectives (write)

### `aureon_create_objective`

**Purpose:** Create a Financial Compass objective. Defaults `automationMode` to `"auto"`.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `name` | yes | Display name |
| `kind` | yes | `stable_allocation` \| `balanced_portfolio` \| `risk_ceiling` \| `reward_reinvestment` |
| `targetWeight` | yes | 0–1 |
| `tolerance` | yes | Drift band 0–1 |
| `priority` | no | `low` \| `medium` \| `high` \| `critical` |
| `maxRiskScore` | no | For risk-ceiling kinds |
| `reinvestRatio` | no | For reward kinds |
| `targetSymbol` | no | Asset symbol (nullable); **locked after create** |
| `automationMode` | no | `auto` \| `manual`; default **`auto`**; **locked after create** |

**When to use:** New policy intent (e.g. maintain ~15% WETH automatically).

**Caveats:** Agents should use **Automatic** (`auto`) unless the human explicitly wants Manual Approve. To change symbol or mode later, create a new objective (pause or leave the old one).

### `aureon_apply_financial_intent`

**Purpose:** Register user/agent intent as an Automatic objective and return the full AI → objective → portfolio flow in one call.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `brief` | yes | What the user wants their money to do — agent-extracted wording |
| `kind` | yes | `stable_allocation` \| `balanced_portfolio` \| `risk_ceiling` \| `reward_reinvestment` |
| `targetWeight` | yes | 0–1 |
| `tolerance` | yes | Drift band 0–1 |
| `targetSymbol` | no | Asset symbol for `balanced_portfolio` |
| `name` | no | Display name override |
| `priority` | no | `low` \| `medium` \| `high` \| `critical` |

**When to use:** turn structured agent intent into persistent policy without stitching create + health + portfolio calls.

**Returns:** `{ intent, objective, health, portfolio, message }` — see `@buildaureon/sdk` `applyFinancialIntent()`.

**Caveats:** Agent must supply structured fields; `brief` is for audit/teaching, not autonomous NLU. Creates a new objective each call.

### `aureon_update_objective`

**Purpose:** Partial update of mutable fields (name, weight, tolerance, priority, optional risk/reinvest fields).

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `objectiveId` | yes | Target |
| `name` | no | Display name |
| `priority` | no | Priority enum |
| `targetWeight` | no | 0–1 |
| `tolerance` | no | 0–1 |
| `maxRiskScore` | no | Optional |
| `reinvestRatio` | no | Optional |

**When to use:** Tighten tolerance; rename; adjust weight without changing token or automation mode.

**Caveats:** **Cannot** change `targetSymbol` or `automationMode`. If the API rejects those fields, recreate instead.

### `aureon_pause_objective`

**Purpose:** Pause continuous evaluation for an objective.

**Typical args:** `objectiveId` (required).

**When to use:** Temporary halt during funding, maintenance, or operator review.

**Caveats:** Paused objectives will not drive Automatic restores until resumed.

### `aureon_resume_objective`

**Purpose:** Resume evaluation for a paused objective.

**Typical args:** `objectiveId` (required).

**When to use:** After funding the vault or finishing a maintenance window.

**Caveats:** Re-check health after resume; a breach may already exist.

---

## Compass / execution

### `aureon_run_execution`

**Purpose:** Run restorative execution for an objective currently outside policy.

**Typical args:** `objectiveId` (required).

**When to use:** Explicit execution path when the product flow calls for `runExecution` rather than vault-backed restore.

**Caveats:** Prefer reading health / plan first. Report settlement type honestly from the receipt.

### `aureon_restore_objective`

**Purpose:** Run vault-backed restorative execution for an objective outside policy (primary agent restore path).

**Typical args:** `objectiveId` (required).

**When to use:** After a clear breach and a reviewed restore plan; Automatic objectives with a funded vault.

**Caveats:** Empty vault or Manual-only product constraints can block or stage settlement. Confirm with `aureon_list_timeline` / `aureon_list_executions`. Read `settlement`, `explorerUrl`, and `registryRef` on every receipt.

### How to read a receipt (agents)

1. Call `aureon_list_executions` or use the receipt from restore/run.
2. Check **`settlement`**: `vault` vs `staged` — never claim on-chain for `staged`.
3. If **`explorerUrl`** is present, the vault tx can be verified on the explorer.
4. If **`registryRef`** is present, the objective was registered on ObjectiveRegistry.
5. Match **`aureon_list_timeline`** events via `payload.executionId === receipt.id`.
6. For vault receipts, check **`verifiedOnChain`**. When true, cite **`settlementRecord`** or call **`aureon_get_execution_settlement`**. Never invent chain proof when `verifiedOnChain` is false.

### `aureon_get_execution_settlement`

**Purpose:** Returns the durable on-chain settlement record for a vault execution when the API listener observed a `Rebalanced` event.

**When to use:** After a vault restore when you need independent chain proof (tx hash, block, token pair, amounts).

**Caveats:** Staged executions return `verifiedOnChain: false` with no settlement. Vault without listener confirmation is **not** chain-verified — say “vault submitted, not yet observed on-chain.”

### `aureon_list_settlements`

**Purpose:** Lists chain-verified settlement records for the wallet (optional `objectiveId` filter).

**When to use:** Audit trail review; cross-check multiple restores.

### `aureon_validate_receipt`

**Purpose:** Validates an execution receipt locally (no API call). Returns `{ valid, issues }`.

**When to use:** After `aureon_restore_objective` or `aureon_list_executions` — confirm the receipt is honest before reporting to the operator.

**Caveats:** Validation is schema + policy only; it does not re-fetch chain state. If `valid: false`, quote `issues` and do not claim on-chain settlement.

---

## Market

### `aureon_apply_market_event`

**Purpose:** Apply a controlled mark shock to a symbol for integration rehearsal; optionally trigger auto-restore.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `symbol` | yes | e.g. `TSLA` |
| `priceChangeRatio` | yes | Fractional change (`-0.1` = −10%) |
| `name` | no | Event label |
| `description` | no | Human description |
| `autoRestore` | no | If true, may run restorative execution on breach |

**When to use:** Demo / rehearsal of drift → plan → restore. Not for production price discovery.

**Caveats:** Do not treat rehearsal shocks as live oracle prices for real capital decisions.

### `aureon_refresh_watchdog`

**Purpose:** Refresh portfolio marks from live data and re-evaluate objectives.

**Typical args:** none.

**When to use:** Morning checks; after market events; before reading health for restore decisions.

**Caveats:** Refresh alone does not restore. Follow with health / plan / restore as needed.

---

## Vault

### `aureon_prepare_vault_deposit`

**Purpose:** Prepare **unsigned** vault deposit steps for a symbol and amount.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `symbol` | yes | `ETH` or allowlisted ERC-20 |
| `amount` | yes | Human-readable amount string |

**When to use:** Fund the vault so Automatic restores can settle on-chain.

**Caveats:** Returns calldata / steps only. The **host** must sign and broadcast with a private key **outside** MCP. API key alone cannot move funds. After broadcast, sync and re-check vault status.

### `aureon_prepare_vault_withdraw`

**Purpose:** Prepare **unsigned** vault withdraw steps.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `amount` | yes | Human-readable amount string |
| `symbol` | no | Default WETH (not ETH) |

**When to use:** Operator-directed withdrawals after confirming vault balances.

**Caveats:** Same non-custodial boundary as deposit — prepare ≠ completed withdrawal until the host broadcasts.

---

## Developer API keys

### `aureon_list_api_keys`

**Purpose:** List API key metadata for the authenticated wallet (no secrets).

**Typical args:** none.

**When to use:** Inventory keys; find IDs for toggle / revoke.

**Caveats:** Secrets are never re-listed after create. Metadata only.

### `aureon_create_api_key`

**Purpose:** Create a new issued SDK API key. The secret is returned **once**.

**Typical args:**

| Arg | Required | Notes |
| --- | --- | --- |
| `name` | yes | Display name (min length enforced) |

**When to use:** Rotate or provision a new agent key under an already-authenticated identity.

**Caveats:** Treat the returned secret like a password. Do not echo it into public chat logs. Store it in the MCP host env as `AUREON_API_KEY`.

### `aureon_revoke_api_key`

**Purpose:** Permanently revoke (delete) an issued API key.

**Typical args:** `keyId` (required).

**When to use:** Key compromise; decommissioning an agent.

**Caveats:** Irreversible for that key material. Confirm the ID from `aureon_list_api_keys`.

### `aureon_toggle_api_key`

**Purpose:** Pause or unpause an API key without revoking it.

**Typical args:** `keyId` (required).

**When to use:** Temporary freeze during investigation; soft disable without rotation.

**Caveats:** Toggled-off keys fail subsequent control-plane calls until re-enabled.

### `aureon_get_audit_trail`

**Purpose:** Export one objective’s financial audit trail — registry, receipts, settlements, timeline — in a single object.

**Typical args:** `objectiveId` (required).

**When to use:** “Did this restore actually happen?” / follow intent → receipt → settlement without stitching four tools.

**Caveats:** Missing proof is labeled as a gap. Staged receipts are never on-chain. Do not invent explorer links or `verifiedOnChain`. Testnet only.

---

## Prompt → tool mapping

| Operator ask | Tool(s) |
| --- | --- |
| “Is the API up?” | `aureon_ping` |
| “Which wallet am I?” | `aureon_me` |
| “Refresh balances from chain” | `aureon_sync_portfolio` |
| “Is the vault funded?” | `aureon_get_vault_status` |
| “Maintain 20% WETH automatic” | `aureon_create_objective` (`automationMode: auto`, `targetSymbol: WETH`) |
| “Why is health red?” | `aureon_get_health`, `aureon_list_timeline` |
| “Show the restore plan” | `aureon_get_restore_plan` |
| “Execute restore” | `aureon_restore_objective` |
| “Export the audit trail” | `aureon_get_audit_trail` |
| “Simulate −10% TSLA” | `aureon_apply_market_event` |
| “Prepare 0.1 ETH deposit” | `aureon_prepare_vault_deposit` then host signs |
| “Rotate my agent key” | `aureon_create_api_key` (+ secure store), optional `aureon_revoke_api_key` |

---

## Related reading

- [Agent guide](./agent-guide.md) — read → decide → act playbooks
- [Auth](./auth.md) — issued key, optional Bearer, private-key boundary
- [Setup](./setup.md) — host configuration for Cursor / Claude Desktop
- [Security](./security.md) — stdio trust boundary and key hygiene
- **@buildaureon/sdk documentation** — typed client methods, data contracts, error model

---

## Notes for implementers

- Tool names are stable strings beginning with `aureon_`.
- Argument validation is strict; omit unknown fields rather than inventing them.
- Prefer read tools before write tools in every agent turn that mutates state.
- Automatic mode is the agent default; Manual mode is a human Approve surface.
- Prepare tools are safe to call with an API key; broadcasting is a separate host step.
- When summarizing restores, always include settlement type when the receipt provides it.

This reference is the canonical MCP tool surface for live agents: **52 tools**, live API, issued key (optional Bearer), and private key only outside MCP for broadcast.
