# Authentication Guide

How **`@buildaureon/mcp`** `v0.1.1` authenticates to the live AUREON API — aligned with `@buildaureon/sdk`, safe for humans and for agents that call the **43** stdio tools.

Related docs: [Setup](./setup.md) · [Tools](./tools.md) · [Agent guide](./agent-guide.md) · [Architecture](./architecture.md) · [Security](./security.md) · [Package README](../README.md)

---

## Who this is for

- **Agent operators** wiring Cursor or Claude Desktop with an issued developer key
- **Integrators** comparing MCP auth to the typed SDK client
- **Security reviewers** checking that private keys never enter the MCP process
- **Agents** reading this file as context before calling `aureon_me`, restore, or vault prepare tools

If you have not configured the host yet, start with [./setup.md](./setup.md), then return here for credential semantics.

---

## Goals of MCP auth

1. Reach `https://api.aureonlabs.network` with credentials the gateway accepts.
2. Bind control-plane actions to a wallet identity (issued key or Bearer session).
3. Keep signing and broadcasting of on-chain vault steps **outside** MCP.
4. Prefer a long-lived issued key for always-on agents over interactive wallet handshakes.

The operator utility at [app.aureonlabs.network](https://app.aureonlabs.network) remains wallet-Bearer oriented for humans. MCP and the SDK share the issued-key path for automation.

---

## Credential types

| Credential | Where you get it | Put it in MCP? | What it does |
| --- | --- | --- | --- |
| **Issued developer API key** | Developers page → create key | Yes — `AUREON_API_KEY` | Product access **and** wallet identity for control-plane tools. **Recommended.** |
| **Bootstrap / env-style key** | Rare / special environments | Only if explicitly issued for that purpose as `AUREON_API_KEY` | Same transport header as an issued key; treat with equal secrecy. Prefer Developers-issued keys for production agents. |
| **Wallet Bearer token** | Wallet sign-in, or `aureon_verify_wallet` | Optional — `AUREON_AUTH_TOKEN` or in-process after verify | Session for utility-style identity. **Wins** when both key and Bearer are present. |
| **Wallet private key** | Your wallet / HSM / signing bot | **Never** in MCP env | Sign and broadcast deposit/withdraw txs **outside** MCP after prepare tools return unsigned steps. |

Plain language:

- **Issued key** = “this agent may call the API as my Developers-bound wallet.”
- **Bearer** = “this process has an active wallet session.”
- **Private key** = “this other process may move funds on chain.” MCP does not hold that.

---

## Environment variables (auth-focused)

| Variable | Role |
| --- | --- |
| `AUREON_API_KEY` | Preferred. Issued developer key from [app.aureonlabs.network](https://app.aureonlabs.network) **Developers**. |
| `AUREON_AUTH_TOKEN` | Optional Bearer. Use when you intentionally want a session without (or in addition to) a key — see conflict rules below. |
| `AUREON_API_URL` | Defaults to `https://api.aureonlabs.network`. Leave default for public use. |

Startup rule: at least one of `AUREON_API_KEY` or `AUREON_AUTH_TOKEN` must be set or the MCP process exits with a clear error.

See also the setup tables in [./setup.md](./setup.md).

---

## Recommended path: issued developer key

This is the default for Cursor, Claude, and other always-on agents.

### Steps

1. Open [https://app.aureonlabs.network](https://app.aureonlabs.network).
2. Connect the wallet that should own objectives and Capital Book state.
3. Open **Developers** and create a key (name it after the host, e.g. `cursor-mcp`).
4. Copy the secret once into the host MCP `env` as `AUREON_API_KEY`.
5. Do **not** set `AUREON_AUTH_TOKEN` unless you have a specific reason.
6. Restart the host and call `aureon_ping` then `aureon_me`.

Minimal env:

```bash
AUREON_API_URL=https://api.aureonlabs.network
AUREON_API_KEY=aureon_....
```

With only the issued key, agents can sync portfolio, create objectives, fetch restore plans, restore, refresh watchdog, and manage developer keys — without an interactive signature each session.

Rotate or revoke from the same Developers page if the secret is exposed. Update the host config immediately after rotation.

---

## Optional wallet handshake (Bearer session)

Use when you need a utility-style session, when debugging auth, or when an issued key is unavailable and you already hold a Bearer.

### Tools involved

| Tool | Role |
| --- | --- |
| `aureon_get_auth_nonce` | Fetch an EIP-191 challenge message for an address |
| `aureon_verify_wallet` | Submit address + message + signature (+ optional invite); **stores** the returned Bearer in-process |
| `aureon_logout` | Revoke the session server-side and clear the in-process token |
| `aureon_me` | Show the wallet for the active key or Bearer |
| `aureon_dev_login` | Preview-only login — **not** available on the production API |

### Sequence

```text
Agent → aureon_get_auth_nonce(address)
     ← challenge message

Agent → host wallet signs message (EIP-191)  [outside MCP]
     ← signature

Agent → aureon_verify_wallet(address, message, signature, inviteCode?)
     ← token; MCP session.setToken(token)

Later tools use getAccessToken() from the in-process session provider.
```

Early access may require an `inviteCode` on first verify for a new wallet.

You may also seed `AUREON_AUTH_TOKEN` in the host env if you already obtained a Bearer elsewhere. That token is loaded into the same in-process session provider at startup.

Prefer issued keys for unattended agents. Handshakes need a human (or separate signing host) for every new session after logout or process restart — unless the Bearer is re-injected via env.

---

## How MCP stores Bearer in-process

On startup, `@buildaureon/mcp` builds an `@buildaureon/sdk` client with:

- `apiKey` from `AUREON_API_KEY` (if set)
- `getAccessToken` from a small session provider initialized with `AUREON_AUTH_TOKEN` (if set)

When `aureon_verify_wallet` (or `aureon_dev_login` on a preview API) succeeds, the MCP layer calls `session.setToken(token)`.

When `aureon_logout` succeeds, it clears the in-process token after the API revoke.

Important properties:

- The Bearer lives **only in the MCP process memory** (plus whatever you put in host env).
- Restarting the host clears memory unless `AUREON_AUTH_TOKEN` is still in env.
- MCP does not write tokens to disk and does not sync them into Cursor chat history by itself — but agents may echo tool results; treat tool output as sensitive.

Issued keys do not need this session store for identity. The key header alone identifies the Developers-bound wallet.

---

## `aureon_me` and `aureon_logout`

### `aureon_me`

Returns the wallet bound to the **effective** credential the gateway sees: issued key identity, or Bearer session when a Bearer is active and winning.

Use it as the first identity check after setup:

- Expected address matches your Developers wallet → good.
- Unexpected address → you likely have a stale Bearer winning over the key (see conflict rules).

### `aureon_logout`

Revokes the current Bearer session and clears the in-process token.

It does **not** revoke your issued developer API key. Key lifecycle is managed on the Developers page (`aureon_revoke_api_key` / pause toggle tools, or the UI).

After logout, if only `AUREON_API_KEY` remains, subsequent tools continue as the key-bound wallet. If you had neither key nor a remaining env Bearer, authenticated calls will fail until you configure credentials again.

---

## What MCP never does

| Action | MCP behavior |
| --- | --- |
| Hold a wallet private key | Never — not in env, not in tool args, not in memory by design |
| Sign EIP-191 auth challenges | Host / wallet signs; MCP only transports nonce and verify |
| Sign or broadcast vault txs | `aureon_prepare_vault_*` returns **unsigned** steps only |
| Custodialize funds | Non-custodial; settlement remains plan-driven on the API / vault |
| Replace the operator utility | Humans still use the app; MCP is the agent adapter |
| Enable `aureon_dev_login` on production | Production rejects it; use issued keys |

If an agent asks for a private key “so MCP can deposit,” refuse and point to prepare → external sign → sync. See [./security.md](./security.md).

---

## Conflict rules: key + Bearer together

Both credentials may be present:

1. Host sets `AUREON_API_KEY` **and** `AUREON_AUTH_TOKEN`, or
2. Host sets only the key, then the agent runs `aureon_verify_wallet` and stores a Bearer in-process.

**Rule:** when both are sent on a request, the **Bearer wins** for wallet identity.

Implications:

- An old Bearer can mask a freshly rotated issued key’s wallet.
- Debugging “wrong wallet on `aureon_me`” almost always means clear Bearer: call `aureon_logout`, remove `AUREON_AUTH_TOKEN` from env, restart the host.
- For always-on agents, keep config key-only so identity is predictable across restarts.

Bootstrap or special env keys still travel as `AUREON_API_KEY`. They do not change the Bearer-wins rule when a session token is also attached.

---

## Private key: outside MCP only

Vault deposit and withdraw are two-phase:

1. **MCP / SDK prepare** — `aureon_prepare_vault_deposit` or `aureon_prepare_vault_withdraw` returns unsigned calldata / steps.
2. **External signer** — a wallet UI, hardware wallet, or a separate `@buildaureon/sdk` script with a private key broadcasts the txs.
3. **Sync** — `aureon_sync_portfolio` / `aureon_get_vault` to refresh Capital Book state.

Never paste a private key into MCP tool arguments or host env “for convenience.” That expands the blast radius of every chat that can invoke tools.

---

## Common errors

| Error / symptom | Meaning | Fix |
| --- | --- | --- |
| Startup: set `AUREON_API_KEY` or `AUREON_AUTH_TOKEN` | No credential configured | Add issued key to host `env` — [./setup.md](./setup.md) |
| `401` Unauthorized | Key revoked/paused, Bearer expired, or typo | Rotate key or re-verify wallet |
| Wrong wallet on `aureon_me` | Bearer winning over key | `aureon_logout`; remove env Bearer; restart |
| `aureon_verify_wallet` fails | Bad signature, stale nonce, or missing invite | New nonce; re-sign; supply `inviteCode` if required |
| `aureon_dev_login` fails on live API | Expected | Use issued key on `https://api.aureonlabs.network` |
| Prepare tools succeed but funds do not move | Unsigned steps not broadcast | Sign outside MCP with a real wallet |
| Agent invents a local API URL | Misconfigured override | Reset `AUREON_API_URL` to the live default |

Map structured SDK errors in tool output to the same categories; do not retry blindly on `401` without rotating credentials.

---

## Agent-safe practices

1. **Prefer issued keys** in host config; avoid interactive Bearer for unattended loops.
2. **Never request private keys** in chat; guide operators to prepare → external broadcast.
3. **Do not echo full API keys or Bearers** back into long chat logs when summarizing tool results.
4. **Call `aureon_me` once** after connect to confirm identity before write tools.
5. **On identity mismatch**, clear Bearer before creating objectives or restoring.
6. **Treat Developers keys like passwords** — rotate on leak; use labeled keys per host.
7. **Keep MCP local stdio** — do not expose the process on a public port.
8. **Read** [./agent-guide.md](./agent-guide.md) before multi-step restore or market-event rehearsals.
9. **Respect locked objective fields** — recreate rather than fighting update errors (see tools doc).
10. **Assume tool output may be logged** by the host; minimize secret material in responses.

---

## Topology (mental model)

```text
MCP host (Cursor / Claude)
    │  stdio
    ▼
@buildaureon/mcp  (52 tools, no private key)
    │
    ▼
@buildaureon/sdk  (HTTP, retries, types)
    │  HTTPS + API key and/or Bearer
    ▼
https://api.aureonlabs.network
    │
    ├── control plane (objectives, portfolio, restore, …)
    └── prepare vault steps → human/agent signs elsewhere
```

Architecture detail: [./architecture.md](./architecture.md).

---

## FAQ

### Is an issued key enough for restore?

Yes. `aureon_restore_objective` and related control-plane tools authenticate with the issued key. On-chain funding of the vault still needs external signing when deposits are required.

### When should I use Bearer instead?

Interactive debugging, parity with the operator utility session model, or short-lived demos. Not the default for scheduled agents.

### What is a “bootstrap” key in this doc?

A key supplied via environment rather than freshly minted in the UI mid-session. Operationally it still goes in `AUREON_API_KEY`. Prefer Developers-issued keys you can pause and revoke from the console.

### Does logout delete my API key?

No. Logout clears Bearer session state. Manage keys on the Developers page or via developer tools.

### Can MCP and the SDK share the same issued key?

Yes. Same live API, same key family. Revoking the key affects both surfaces.

### Why does Bearer win over the key?

So an explicit wallet session can override key identity when operators intentionally complete a handshake. For agents, avoid that ambiguity by not setting Bearer.

### Where do I configure credentials?

In the MCP host `env` block — see Cursor / Claude examples in [./setup.md](./setup.md). Primary launch remains `npx -y @buildaureon/mcp`.

---

## Rotating credentials safely

When a key may have leaked (pasted in chat, committed to a repo, shared in a screenshot):

1. Open [app.aureonlabs.network](https://app.aureonlabs.network) → **Developers**.
2. Pause or revoke the compromised key immediately.
3. Create a replacement key with a new label.
4. Update every MCP host `env` that still references the old secret.
5. Restart those hosts so in-memory clients reload.
6. Call `aureon_me` once to confirm the bound wallet is unchanged and authorized.

If a Bearer may have leaked, call `aureon_logout` from a trusted session (if still valid), remove `AUREON_AUTH_TOKEN` from env, and re-verify only if you still need a session. Prefer switching the agent to issued-key-only afterward.

Do not reuse the compromised secret “temporarily.” Treat rotation as mandatory once exposure is plausible.

---

## Relationship to the SDK

`@buildaureon/mcp` does not invent a second auth protocol. It configures `createAureonClient` from `@buildaureon/sdk` with the same headers the SDK would send in a script:

- Issued key → API key header / client option
- Bearer → access token via the session provider
- Base URL → `https://api.aureonlabs.network` by default

If a typed SDK script works with your issued key but MCP fails, compare env names (`AUREON_API_KEY` vs hard-coded client options) and confirm the host actually injects env into the stdio child process.

Package version for this guide: **`@buildaureon/mcp` `v0.1.1`**.

---

## Quick reference checklist

- [ ] Issued key from Developers page in `AUREON_API_KEY`
- [ ] No private key anywhere in MCP config
- [ ] `AUREON_AUTH_TOKEN` unset unless you need a session
- [ ] `aureon_me` shows the expected wallet
- [ ] You know Bearer wins if both are present
- [ ] Vault moves use prepare tools + external signer
- [ ] Leaked secrets → revoke / rotate on Developers
- [ ] After rotation, every host env updated and restarted

---

## Next steps

- Finish host wiring: [./setup.md](./setup.md)
- Tool schemas: [./tools.md](./tools.md)
- Playbooks: [./agent-guide.md](./agent-guide.md)
- Boundaries: [./architecture.md](./architecture.md)
- Threat model: [./security.md](./security.md)
- Package home: [../README.md](../README.md)
