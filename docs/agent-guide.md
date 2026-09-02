# AUREON MCP Agent Guide

Playbooks for AI agents using `@buildaureon/mcp` against the **live** AUREON API.

This guide teaches agents how to think, which tools to call, and how to talk honestly about settlement. Pair it with the [tool reference](./tools.md). For typed contracts and error codes, see the **@buildaureon/sdk documentation**.

**Surface:** 52 tools · issued API key · optional Bearer · private key only outside MCP for broadcast.

---

## How agents should think

Use a simple loop on every non-trivial request:

**Read → Decide → Act.**

### 1. Read

Gather facts before proposing mutations.

Typical read set:

- `aureon_ping` — is the live API up?
- `aureon_me` — which wallet am I acting as?
- `aureon_sync_portfolio` + `aureon_get_portfolio` — what does the Capital Book say?
- `aureon_get_vault_status` — can Automatic restores actually fund?
- `aureon_list_objectives` + `aureon_get_health` — what policy exists and is it breached?

### 2. Decide

Translate operator intent into a **single** next action (or a short sequenced plan).

Decide:

- Do we need funding first (prepare deposit → host signs)?
- Do we create a new Automatic objective?
- Do we restore an existing breach?
- Is this only a rehearsal (market event)?

Prefer **Automatic** (`automationMode: "auto"`) for agents. Manual mode is for humans who must Approve in the utility.

### 3. Act

Call the write / prepare / restore tool. Then **read again** to confirm.

Never claim success from prepare alone. Never claim on-chain settlement unless the receipt says `settlement: "vault"`.

---

## Trust boundary (memorize this)

| Credential | Role |
| --- | --- |
| Issued `AUREON_API_KEY` | Product access + wallet identity for control-plane tools |
| Optional Bearer | Wallet session via nonce → sign → `aureon_verify_wallet` (wins if both present) |
| Private key | **Outside MCP only** — host signs unsigned vault steps |

The MCP server is not a custodian and not a broadcaster. `prepare_*` returns unsigned steps.

---

## Locked fields and defaults

| Field | Rule |
| --- | --- |
| `automationMode` | Defaults to **`auto`** on create. Locked after create. |
| `targetSymbol` | Locked after create. Recreate to change the token. |
| Update patch | Name, weight, tolerance, priority (and related numeric fields) — **not** symbol/mode. |

Agents: create Automatic objectives unless the human explicitly asks for Manual.

---

## Settlement types

Restore and execution receipts may include:

| Value | Meaning | How to describe it |
| --- | --- | --- |
| `vault` | On-chain / vault-backed settlement | “Settled on-chain via vault.” |
| `staged` | Ledger-local / staged settlement | “Staged (not on-chain).” |

**Honesty rule:** If the field is missing or unclear, say so. Do not upgrade `staged` to “on-chain” in chat.

---

## How to read a Phase 2 receipt

After `aureon_restore_objective` or `aureon_run_execution`, inspect the returned receipt:

| Field | What to tell the operator |
| --- | --- |
| `settlement: "vault"` | Restored via vault keeper path; may have on-chain tx |
| `verifiedOnChain: true` | Listener observed vault `Rebalanced` event — cite `settlementRecord` |
| `verifiedOnChain: false` + `settlement: "vault"` | Vault path but **not yet** independently observed — do not claim chain proof |
| `settlement: "staged"` | Capital-book update only — **not** on-chain settlement |
| `explorerUrl` | Link to block explorer when vault tx exists |
| `registryRef` | Objective registered on testnet registry — cite `objectiveKey` + contract |
| `status` | `confirmed` / `failed` / etc. — do not infer success from prepare alone |

Cross-check with `aureon_list_timeline`: find events where `payload.executionId` matches `receipt.id` and confirm `payload.settlement` matches the receipt.

**Do not say:** “Every restore is on-chain.” Staged receipts are honest book updates when vault is unavailable or unfunded. Do not say “chain-verified” unless `verifiedOnChain` is true or `aureon_get_execution_settlement` returns a record. After every restore, call **`aureon_validate_receipt`** — if validation fails, report the issues and do not override them.

---

## Recommended workflows

### A. Morning check

Goal: identity, book, vault readiness, health — no surprise mutations.

```text
aureon_ping
aureon_me
aureon_sync_portfolio
aureon_get_portfolio
aureon_get_vault_status
aureon_get_overview
aureon_list_objectives
aureon_refresh_watchdog
aureon_get_health
```

**Agent summary checklist**

- Wallet address
- Whether vault looks fundable / ready
- Objective count and any breaches
- One recommended next action (fund, restore, or none)

### B. Create an Automatic objective

Example intent: maintain ~15% WETH with 3% tolerance.

**Read first**

```text
aureon_me
aureon_sync_portfolio
aureon_get_vault_status
aureon_list_objectives
```

**Act**

```text
aureon_create_objective
  name: "Maintain 15% WETH"
  kind: balanced_portfolio
  targetWeight: 0.15
  tolerance: 0.03
  targetSymbol: WETH
  automationMode: auto
  priority: medium
```

**Confirm**

```text
aureon_get_objective
aureon_get_health
```

Remind the operator that `targetSymbol` and `automationMode` are locked.

### C. Restore drift

```text
aureon_refresh_watchdog
aureon_get_health
aureon_get_restore_plan      # when breached — explain steps
aureon_restore_objective
aureon_list_timeline
aureon_list_executions
aureon_get_health            # post-check
```

**Agent summary checklist**

- Pre-health vs post-health
- Plan kind (e.g. vault swap / wrap)
- Receipt `settlement` (`vault` vs `staged`)
- Timeline events confirming the restore

If vault status says funding is insufficient, stop and switch to the deposit workflow.

### D. Vault deposit (prepare + host signs)

```text
aureon_get_vault_status
aureon_prepare_vault_deposit
  symbol: ETH
  amount: "0.1"
→ host signs & broadcasts unsigned steps (private key outside MCP)
→ wait for confirmation
aureon_sync_portfolio
aureon_get_vault_status
aureon_get_vault
```

**Agent language**

- After prepare: “Here are unsigned steps. Sign and broadcast in your wallet. I cannot move funds with the API key alone.”
- After sync: report vault readiness. Do not invent tx hashes the host did not provide.

### E. Market rehearsal (integration only)

```text
aureon_list_market_presets
aureon_apply_market_event
  symbol: TSLA
  priceChangeRatio: -0.1
aureon_refresh_watchdog
aureon_get_health
# optional: restore_plan → restore_objective if rehearsing the full loop
```

Do **not** treat rehearsal shocks as live oracle prices for production capital decisions.

### F. Pause / resume / soft update

```text
aureon_pause_objective
aureon_resume_objective
aureon_update_objective   # name, weight, tolerance, priority only
```

To change token or auto/manual mode: create a new objective; pause or leave the old one.

### G. API key hygiene

```text
aureon_list_api_keys
aureon_create_api_key     # secret once — store in host env
aureon_toggle_api_key     # pause without revoke
aureon_revoke_api_key
```

Never paste full secrets into public transcripts if the host displays tool output broadly.

### H. Green vs plan paradox demo 

```text
aureon_set_portfolio          # or aureon_sync_portfolio
aureon_create_objective       # stable_allocation, targetWeight 0.2, tolerance 0.02
aureon_get_allocation_vs_target   # baseline: rows aligned
aureon_apply_market_event
  symbol: NVDA
  priceChangeRatio: 0.45
  autoRestore: false
aureon_get_allocation_vs_target   # paradox: book up, stable off-plan
aureon_get_health
aureon_list_timeline
```

**Agent language**

- Before shock: “Objective vs actual are aligned — stable sleeve at target.”
- After shock with `autoRestore: false`: “Book is up {X}%, but your stable objective is at {current}% vs {target}% target — {state}. Portfolio performance and plan adherence are not the same signal.”
- Do **not** claim on-chain proof for rehearsal marks; they are controlled and staged.

### I. AI → objective → portfolio

```text
aureon_sync_portfolio
aureon_apply_financial_intent
  brief: "Keep about 20% in stable assets"
  kind: stable_allocation
  targetWeight: 0.2
  tolerance: 0.02
aureon_get_objective_portfolio_flow   # confirm intent → objective → portfolio link
aureon_get_allocation_vs_target         # ties to objective vs actual
```

**Agent language**

- “You told me what you want your money to do. I registered that as an objective.”
- “Here is how your portfolio scores against that policy — not just total PnL.”
- The agent must still supply structured fields (`kind`, `targetWeight`, `tolerance`); `brief` captures user wording for audit and teaching.
- After intent is applied, use `aureon_get_allocation_vs_target` for ongoing objective vs actual checks.

### J. Drift → detection → restore

```text
aureon_set_portfolio          # or aureon_sync_portfolio
aureon_create_objective       # stable_allocation, targetWeight 0.2, tolerance 0.02
aureon_apply_market_event
  symbol: NVDA
  priceChangeRatio: 0.45
  autoRestore: false          # break the rule on purpose
aureon_get_health
aureon_get_restore_plan
aureon_restore_objective
aureon_get_drift_restore_flow # confirm three-beat flow
aureon_list_timeline
```

Or one-shot: `aureon_run_drift_restore_demo`.

**Agent language**

- Beat 1: “Rule set — stable sleeve at ~20% target.”
- Beat 2: “NVDA rally moved the book. Stable allocation drifted off policy — {state}.”
- Beat 3: “Restore plan executed. Receipt settlement is `{vault|staged}`. Health back within tolerance.”
- Link back to  (`aureon_get_allocation_vs_target` with `autoRestore: false`) and  (intent before the rule exists).
- Do **not** claim discretionary trading; this is controlled rehearsal against registered policy.

### K. Receipt → verification 

```text
aureon_run_drift_restore_demo       # or aureon_restore_objective after drift
aureon_list_executions
aureon_validate_receipt             # local — must pass before claiming proof
aureon_get_execution_settlement     # vault — independent chain record when present
aureon_get_receipt_verification_flow
aureon_list_timeline
```

Or one-shot: `aureon_run_receipt_verification_demo`.

**Agent language**

- Beat 1: “Restore returned a receipt — status `{status}`, result says `{result}`. That is a **claim**, not proof.”
- Beat 2: “`aureon_validate_receipt` — schema + honesty check. If invalid, report issues; do not say success.”
- Beat 3: “For vault receipts, `aureon_get_execution_settlement` — `verifiedOnChain: true` means independent settlement record. Staged receipts can validate but are **never** chain-verified.”
- Link back to (receipt exists after restore). Never say “chain-verified” unless `verifiedOnChain` or settlement record confirms it.

### L. Portfolio watch while away 

```text
aureon_ping
aureon_me
aureon_apply_financial_intent
  brief: Watch my portfolio while I'm away — keep about 20% in stable assets.
  kind: stable_allocation
  targetWeight: 0.2
  tolerance: 0.02
aureon_refresh_watchdog
aureon_get_health
aureon_apply_market_event
  symbol: NVDA
  priceChangeRatio: 0.45
  autoRestore: true
aureon_list_timeline
aureon_get_portfolio_watch_flow
```

Or one-shot: `aureon_run_portfolio_watch_demo`.

**Agent language**

- Beat 1: “You asked me to watch your portfolio while away. I registered that as an **Automatic** objective — not a blank check, a rule.”
- Beat 2: “While you were away, the market moved. Automatic mode evaluated health and restored when off-plan.”
- Beat 3: “Here is your return briefing — health, timeline, and what happened. Use tools if you need receipt verification.”
- Host context: say **Cursor** or **Claude** when demoing agent-in-host; never claim 24/7 unsupervised trading.
- Link back to (intent → objective) and (drift/restore with `autoRestore: false` vs **true** here).

### M. Full AUREON loop 

```text
aureon_apply_financial_intent
  brief: Keep about 20% in stable assets — grow the book without abandoning the plan.
  kind: stable_allocation
  targetWeight: 0.2
  tolerance: 0.02
aureon_get_allocation_vs_target
aureon_apply_market_event
  symbol: NVDA
  priceChangeRatio: 0.45
  autoRestore: false
aureon_get_allocation_vs_target   # paradox — green book, off-plan
aureon_restore_objective
aureon_validate_receipt
aureon_get_full_aureon_loop_flow
```

Or one-shot: `aureon_run_full_aureon_loop_demo`.

**Agent language**

- Positioning: “We're not building another portfolio tracker.”
- Beat 1: Intent registered as policy — not a price chart goal.
- Beat 2: Book can look fine while the plan fails — show paradox after shock.
- Beat 3: Restore closes the loop; receipt must be validated before claiming success.
---

## Prompt examples

### System prompt fragment (paste-ready)

```text
You have AUREON MCP tools against the live API.
Prefer aureon_ping / aureon_me / aureon_sync_portfolio before mutations.
Use automationMode auto unless the user explicitly asks for manual.
Never claim on-chain settlement unless the restore receipt says settlement=vault.
Never ask the user for a private key; for deposits call prepare tools and tell them
to sign the returned steps in their wallet.
targetSymbol and automationMode are immutable after create — recreate instead of update.
Follow read → decide → act. Confirm with a second read after writes.
```

### Operator prompts that work well

> Ping AUREON and show which wallet my issued key is bound to.

> Sync my portfolio, check vault status, and summarize whether Automatic restores can run.

> Create an Automatic objective to keep about 20% WETH with 2% tolerance. Confirm locks.

> Health looks off — show the restore plan for objective `<id>`, then restore if the plan is sensible. Report settlement type.

> Prepare a 0.05 ETH vault deposit. Do not try to broadcast. Tell me exactly what I must sign.

> Rehearse a −10% TSLA mark event, refresh watchdog, and report which objectives breached.

### Operator prompts to clarify before acting

> “Fix my portfolio.” → Ask which objective, whether to restore vs recreate, and whether the vault is funded.

> “Make it manual.” → Confirm they want Manual Approve (human UI). Prefer staying Automatic for agent loops.

> “Deposit 1 ETH.” → Clarify prepare-only vs they will sign; never imply MCP will broadcast.

---

## Anti-patterns

Avoid these failure modes.

| Anti-pattern | Why it hurts | Do this instead |
| --- | --- | --- |
| Write before read | Acts on stale identity / vault / health | Always ping / me / sync / vault status first |
| Creating Manual by default | Agents cannot Approve in the utility | Default `automationMode: auto` |
| Patching `targetSymbol` or mode | API rejects; wastes turns | Recreate the objective |
| Treating prepare as funded | Balances unchanged until broadcast | Tell host to sign; then sync |
| Spamming restore | Flapping health, noisy timeline | Re-read health; restore once; confirm |
| Calling market events “live prices” | Misleads capital decisions | Label as rehearsal |
| Claiming `staged` as on-chain | Breaks trust | Quote `settlement` literally |
| Inventing missing audit proof | Fake explorer / registry / settlement | Use `aureon_get_audit_trail` and report labeled gaps |
| Asking for private keys | Violates the trust model | Prepare tools + host wallet only |
| Clearing portfolio casually | Destructive book wipe | Confirm; prefer sync |
| Rotating keys into chat | Secret leakage | Create key; instruct secure env storage |

---

## Automatic-only guidance for agents

Agents operate best as **keepers with Automatic objectives**:

1. Ensure vault funding (prepare → host signs → sync).
2. Create objectives with `automationMode: "auto"`.
3. Watch health via `aureon_refresh_watchdog` / `aureon_get_health`.
4. On breach: plan → `aureon_restore_objective` → confirm timeline / executions.

Manual mode remains available for humans who want Approve gates. If the operator insists on Manual, say clearly that agent-driven restores may be limited and the utility Approve surface is the control plane for those swaps.

---

## Error handling tips

| Symptom | Likely cause | Agent action |
| --- | --- | --- |
| 401 / invalid key | Bad or revoked issued key | Stop. Ask operator to rotate in Developers and update host env. |
| Wallet session required / env key cannot identify wallet | Non-issued gating key | Switch to an **issued** Developers key. |
| Vault empty / cannot restore | No funding for Automatic path | Prepare deposit; wait for broadcast; re-sync; re-check status. |
| Update rejects symbol / mode | Immutable create fields | Explain lock; offer recreate + pause old. |
| Restore flaps / healthy immediately | Marks shifted or race | Re-read health + vault; avoid spam restores. |
| Prepare succeeds, balances unchanged | Broadcast never happened | Remind: unsigned steps need host signature. |
| Invite / early-access errors on verify | Wallet not invited | Use issued key path or complete invite on first Bearer login. |
| Ambiguous settlement | Receipt missing or staged | Report exactly what the receipt says. |

### Retry discipline

- Retry **reads** after transient network errors.
- Do not blindly retry **restores** or **clears**.
- After a failed write, re-read state before a second attempt.
- After prepare, do not call prepare in a loop hoping balances change — wait for the host.

---

## FAQ

### Do I need a Bearer token every day?

No. An issued API key is enough for control-plane agent work. Bearer is optional.

### Can the MCP server sign deposits?

No. Prepare tools return unsigned steps. Private keys stay outside MCP.

### Why is my restore `staged`?

Staged means ledger-local settlement for that receipt. Fund the vault and use Automatic restore paths when you need `settlement: "vault"`. Always label honestly.

### Can I change `targetSymbol` later?

No. Recreate the objective. Optionally pause the old one.

### What is the default automation mode?

`auto`. Agents should keep it that way unless the human requests Manual.

### Is market event a production price feed?

No. It is for integration rehearsal and demos.

### How many tools are there?

**47.** See the [tool reference](./tools.md).

### Where are the typed schemas?

In the **@buildaureon/sdk documentation** (client API, data contracts, error model).

### What URL should agents use?

The live API: `https://api.aureonlabs.network`.

### What if the operator asks me to “just send the transaction”?

Refuse to take a private key. Call `aureon_prepare_vault_deposit` or `aureon_prepare_vault_withdraw`, return the unsigned steps, and instruct the host wallet to sign and broadcast.

---

## Suggested turn templates

### Template: status report

1. Ping + me  
2. Sync portfolio + vault status  
3. Overview + health  
4. Three-bullet summary + one recommended action  

### Template: create policy

1. Confirm wallet + vault readiness  
2. Create Automatic objective with explicit weight/tolerance/symbol  
3. Fetch objective + health  
4. State locks (`targetSymbol`, `automationMode`)  

### Template: heal breach

1. Refresh watchdog + health  
2. Get restore plan; narrate steps briefly  
3. Restore  
4. List executions/timeline; quote `settlement`  
5. Re-check health  

### Template: fund vault

1. Vault status  
2. Prepare deposit  
3. Hand unsigned steps to operator  
4. After they confirm broadcast: sync + vault status  

---

## Coordination with humans

Agents should be explicit about what only a human can do:

- Sign and broadcast vault steps
- Approve Manual restores in the utility
- Create / rotate issued API keys in a secure secret store
- Decide risk appetite (weights, tolerances, which symbols)

Agents should be decisive about what they can do alone with an issued key:

- Sync and inspect book / vault / health
- Create Automatic objectives
- Fetch plans and run restores
- Rehearse market events
- Pause / resume / soft-update objectives

---

## Related reading

- [Tools](./tools.md) — purpose, args, when to use, caveats per tool  
- [Auth](./auth.md) — issued key, optional Bearer, private-key boundary  
- [Setup](./setup.md) — wiring Cursor / Claude Desktop to the live API  
- [Security](./security.md) — stdio trust model and key hygiene  
- **@buildaureon/sdk documentation** — deeper contracts for builders  

---

## Quick reference card

```text
READ:   ping → me → sync_portfolio → vault_status → health
DECIDE: fund? create auto? restore? rehearse only?
ACT:    prepare_* (host signs) | create_objective(auto) | restore_objective
CHECK:  timeline / executions / health — quote settlement=vault|staged
```

Keep the loop short. Prefer Automatic. Never invent settlement. Never touch private keys inside MCP.

---

## Appendix: decision matrix

| Situation | First tools | Then | Stop if |
| --- | --- | --- | --- |
| New session | `aureon_ping`, `aureon_me` | Sync + vault status | Key invalid |
| Want new policy | List objectives + vault status | `aureon_create_objective` (auto) | Vault empty and restores required |
| Health red | Watchdog + health + plan | `aureon_restore_objective` | Plan unclear / unfunded |
| Need capital in vault | `aureon_prepare_vault_deposit` | Host signs outside MCP | Operator cannot sign |
| Demo shock | List presets + apply event | Health / optional restore | Treating marks as production |
| Soft policy tweak | `aureon_get_objective` | `aureon_update_objective` | Trying to change symbol/mode |
| Change token or mode | Pause or leave old | Create new Automatic objective | Patching locked fields |
| Key rotation | `aureon_list_api_keys` | Create → store secret → revoke old | Echoing secret in public chat |

### Narrative examples (short)

**Morning.** “API is up. Wallet `0x…`. Vault ready. Two Automatic objectives healthy. No action.”

**Create.** “Created Automatic balanced objective for 15% WETH (±3%). `targetSymbol` and `automationMode` are locked. Health is within band.”

**Restore.** “Objective breached after watchdog refresh. Plan was a vault-backed rebalance. Restore receipt `settlement: vault`. Post-health green.”

**Deposit.** “Prepared unsigned deposit for 0.1 ETH. Sign and broadcast in your wallet. After confirmation I will sync and re-check vault status.”

**Rehearsal.** “Applied −10% TSLA rehearsal event. Two objectives breached in marks. This is not a live oracle price.”

### Closing reminders for agents

1. Live API only — issued key (optional Bearer).  
2. Thirty-three tools — see the tool reference for args and caveats.  
3. Automatic by default — Manual is a human Approve surface.  
4. Prepare ≠ funded — host signs outside MCP.  
5. Quote `settlement` — `vault` or `staged`, never invent.  
6. Read → decide → act → read again.
