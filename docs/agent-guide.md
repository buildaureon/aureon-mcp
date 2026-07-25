# AUREON MCP Agent Guide

Playbooks for AI agents using `@buildaureon/mcp` against the **live** AUREON API.

This guide teaches agents how to think, which tools to call, and how to talk honestly about settlement. Pair it with the [tool reference](./tools.md). For typed contracts and error codes, see the **@buildaureon/sdk documentation**.

**Surface:** 34 tools · issued API key · optional Bearer · private key only outside MCP for broadcast.

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

**34.** See the [tool reference](./tools.md).

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
