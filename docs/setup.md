# Setup Guide

Complete installation and host configuration for **`@buildaureon/mcp`** `v0.1.1` against the live AUREON API.

This package is a **stdio** [Model Context Protocol](https://modelcontextprotocol.io) server. It wraps [`@buildaureon/sdk`](https://github.com/buildaureon/aureon-sdk) and exposes **34 tools** so Cursor, Claude Desktop, and other MCP hosts can call the Financial Compass control plane.

Related docs: [Authentication](./auth.md) · [Tools](./tools.md) · [Agent guide](./agent-guide.md) · [Architecture](./architecture.md) · [Security](./security.md) · [Package README](../README.md)

---

## What this guide covers

- What you need before connecting an agent
- Environment variables the MCP process reads
- How to create an issued developer API key
- Cursor and Claude Desktop config (published package first)
- Running via `npx` without a permanent install
- Building from a source clone (optional)
- Smoke prompts to verify the wire is live
- Troubleshooting table, FAQ, and a final checklist

If you only want auth semantics (key vs Bearer vs private key), skip ahead to [./auth.md](./auth.md).

---

## What you need

| Requirement | Notes |
| --- | --- |
| **Node.js 20+** | ESM runtime. Check with `node -v`. |
| **Issued developer API key** | Create at [app.aureonlabs.network](https://app.aureonlabs.network) → **Developers**. Plaintext is shown once. |
| **Network access** | HTTPS to `https://api.aureonlabs.network` (Robinhood Chain early access). |
| **MCP host** | Cursor, Claude Desktop, or any client that can launch a stdio MCP server. |

You do **not** need a wallet Bearer token for day-to-day control-plane tools when you use an issued key.

You do **not** need a private key inside MCP. Private keys are only for signing and broadcasting vault deposit/withdraw transactions **outside** the MCP process after prepare tools return unsigned steps.

The MCP server never custodies funds and never signs chain transactions.

---

## Package at a glance

| Item | Value |
| --- | --- |
| npm package | `@buildaureon/mcp` |
| Version | `0.1.1` |
| Depends on | `@buildaureon/sdk` |
| Transport | stdio MCP (JSON-RPC over stdin/stdout) |
| Tool count | 34 |
| Live API | `https://api.aureonlabs.network` |
| Console | [app.aureonlabs.network](https://app.aureonlabs.network) |

Primary launch command (recommended for hosts):

```bash
npx -y @buildaureon/mcp
```

---

## Environment variables

The process reads these at startup. Put them in your MCP host `env` block (Cursor / Claude), not in chat transcripts.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AUREON_API_KEY` | **Preferred** | — | Issued developer key (`aureon_…`). Product access **and** wallet identity for control-plane tools. |
| `AUREON_AUTH_TOKEN` | Optional | — | Wallet Bearer session. Wins over key identity when both are present on a request. |
| `AUREON_API_URL` | Optional | `https://api.aureonlabs.network` | API base URL. Leave unset unless you intentionally override. |

At least one of `AUREON_API_KEY` or `AUREON_AUTH_TOKEN` must be set or the server refuses to start.

**Recommendation:** set only `AUREON_API_KEY` (and optionally leave `AUREON_API_URL` at the default). That is the agent-friendly path documented in [./auth.md](./auth.md).

Never put a wallet private key in MCP env. Prepare tools return unsigned calldata; the host wallet signs elsewhere.

---

## Create an issued developer API key

1. Open [https://app.aureonlabs.network](https://app.aureonlabs.network).
2. Complete invite / early-access flow if prompted, then connect your wallet.
3. Open **Developers**.
4. Create a key with a clear label (for example `cursor-mcp` or `claude-desktop`).
5. Copy the secret immediately — plaintext is shown once.
6. Paste it into your MCP host config as `AUREON_API_KEY`.
7. If the secret leaks, pause or revoke it from the same Developers page and issue a replacement.

That key binds control-plane calls to your wallet. You do not need a separate Bearer handshake for normal agent work.

---

## Cursor configuration

### Option A — published package (recommended)

Create or edit `.cursor/mcp.json` in the project, or merge into your user MCP config:

```json
{
  "mcpServers": {
    "aureon": {
      "command": "npx",
      "args": ["-y", "@buildaureon/mcp"],
      "env": {
        "AUREON_API_URL": "https://api.aureonlabs.network",
        "AUREON_API_KEY": "aureon_...."
      }
    }
  }
}
```

Restart Cursor (or reload MCP servers). Confirm **aureon** appears under MCP / tools.

Ask a smoke prompt such as: *“Use aureon_ping, then aureon_me.”*

### Option B — from a local build

Use this only when you are iterating on a clone of the package. Replace the working directory with your own clone path.

```json
{
  "mcpServers": {
    "aureon": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/your/clone/mcp",
      "env": {
        "AUREON_API_URL": "https://api.aureonlabs.network",
        "AUREON_API_KEY": "aureon_...."
      }
    }
  }
}
```

Build first (`pnpm build` or `npm run build` inside the MCP package) so `dist/index.js` exists.

Prefer Option A for everyday agent use. Local `cwd` configs are for contributors and package development.

---

## Claude Desktop configuration

Merge the same shape into Claude Desktop’s MCP config file (location depends on your OS; Claude’s docs describe where `claude_desktop_config.json` lives).

```json
{
  "mcpServers": {
    "aureon": {
      "command": "npx",
      "args": ["-y", "@buildaureon/mcp"],
      "env": {
        "AUREON_API_URL": "https://api.aureonlabs.network",
        "AUREON_API_KEY": "aureon_...."
      }
    }
  }
}
```

Restart Claude Desktop after saving. In a new chat, ask the model to list AUREON tools or call `aureon_ping`.

For a from-source Claude entry, use `node` + `dist/index.js` with `"cwd": "/path/to/your/clone/mcp"` the same way as Cursor Option B.

Example templates also ship in the package under `examples/cursor.mcp.json` and `examples/claude-desktop.json`.

---

## Run with npx (no permanent install)

From a terminal, with the key in the environment:

```bash
export AUREON_API_KEY=aureon_....
# optional — live API is already the default
export AUREON_API_URL=https://api.aureonlabs.network

npx -y @buildaureon/mcp
```

On Windows PowerShell:

```powershell
$env:AUREON_API_KEY = "aureon_...."
$env:AUREON_API_URL = "https://api.aureonlabs.network"
npx -y @buildaureon/mcp
```

The process speaks MCP on stdio. Running it in a bare terminal is mainly useful to confirm it starts; hosts like Cursor attach automatically when configured.

You can also add the package to a project:

```bash
npm install @buildaureon/mcp
# or
pnpm add @buildaureon/mcp
```

Hosts should still prefer `npx -y @buildaureon/mcp` so they pick up published fixes without a manual upgrade step.

---

## From-source build (optional)

Use a clone when contributing to `@buildaureon/mcp` or testing unreleased changes. Point every path at **your** clone — never hard-code another machine’s layout.

```bash
cd /path/to/your/clone
pnpm install
pnpm --filter @buildaureon/mcp build
pnpm --filter @buildaureon/mcp start
```

Inside the MCP package directory alone:

```bash
cd /path/to/your/clone/mcp
pnpm install   # or npm install, depending on your workspace setup
pnpm build     # tsup → dist/
pnpm start     # node dist/index.js
```

Useful scripts (from `package.json`):

| Script | Purpose |
| --- | --- |
| `build` | Compile with `tsup` into `dist/` |
| `dev` | Run TypeScript entry via `tsx` (hot iteration) |
| `start` | `node dist/index.js` (what hosts should launch after build) |
| `typecheck` | `tsc --noEmit` |
| `test` | Unit / smoke tests |

Wire the host to `node dist/index.js` with `cwd` set to `/path/to/your/clone/mcp` as shown above.

Always authenticate against the **live** API with an issued key from the Developers page. Do not invent local secret files or private API endpoints for normal setup.

---

## Smoke prompts

After the host shows the aureon server as connected, try these in order:

1. **Connectivity** — “Call `aureon_ping` and summarize the response.”
2. **Identity** — “Call `aureon_me` and tell me which wallet is bound.”
3. **Read path** — “Sync my portfolio with `aureon_sync_portfolio`, then `aureon_get_vault_status`.”
4. **Objectives** — “List objectives with `aureon_list_objectives`.”
5. **Health** — “Show compass health with `aureon_get_health`.”

If ping works but `aureon_me` fails, the key is likely invalid, paused, or revoked — rotate from Developers and update the host `env`.

For write workflows (create objective, restore, prepare vault), see [./agent-guide.md](./agent-guide.md) and the full schemas in [./tools.md](./tools.md).

---

## Verify the tool surface

A healthy install exposes auth, read, objective, portfolio, execution, market, vault prepare, and developer key tools — **34** in total.

You do not need every tool on day one. Start with:

- `aureon_ping`
- `aureon_me`
- `aureon_sync_portfolio`
- `aureon_list_objectives`
- `aureon_get_health`

Vault **prepare** tools return unsigned steps only. Signing and broadcasting stay with your wallet or a separate SDK script that holds a private key — never the MCP env. Details: [./auth.md](./auth.md) and [./security.md](./security.md).

---

## Troubleshooting

| Symptom | Likely cause | What to try |
| --- | --- | --- |
| Server missing in host UI | Config JSON invalid or host not restarted | Validate JSON, restart Cursor / Claude |
| Startup error about missing credentials | Neither key nor Bearer set | Set `AUREON_API_KEY` in the host `env` block |
| `401` / unauthorized on tools | Bad, paused, or revoked key | Create a new issued key; update config |
| `npx` hangs or fails | Network / registry issue | Retry; ensure Node 20+; try `npm view @buildaureon/mcp version` |
| Tools listed but every call fails | Wrong `AUREON_API_URL` | Remove override or set `https://api.aureonlabs.network` |
| `aureon_me` shows unexpected wallet | Bearer also set and winning | Clear `AUREON_AUTH_TOKEN` / logout; prefer key-only — see [./auth.md](./auth.md) |
| Local `node dist/index.js` fails | Missing build | Run `pnpm build` so `dist/index.js` exists |
| Deposit / withdraw “not signed” | Expected | MCP returns unsigned steps; sign outside MCP |
| `aureon_dev_login` fails | Production API | Expected — use issued key on live API |

Still stuck? Confirm HTTPS reachability to the API, then re-check that the key string has no extra quotes or trailing spaces in the host config.

---

## FAQ

### Do I need to install the package globally?

No. Prefer `npx -y @buildaureon/mcp` in the host config so the published `v0.1.1` (or newer) is fetched on demand.

### Is a Bearer token required?

No for the recommended agent path. An issued `AUREON_API_KEY` is enough for control-plane tools. Bearer is optional and documented in [./auth.md](./auth.md).

### Can I put my private key in the MCP config?

No. Keep private keys out of MCP. Use them only in a separate signing host when broadcasting prepared vault transactions.

### Does MCP talk to a local backend?

Public setup uses `https://api.aureonlabs.network` only. Point hosts at that URL (or omit `AUREON_API_URL` to use the default).

### How is this different from `@buildaureon/sdk`?

The SDK is for typed TypeScript programs. MCP is the same surface as **named tools** for AI hosts over stdio. Both authenticate the same way against the live API.

### Where do I rotate a leaked key?

[app.aureonlabs.network](https://app.aureonlabs.network) → **Developers** → pause / revoke → create a new key → update the host `env`.

### What Node version is required?

Node.js **20 or newer**. Older runtimes are unsupported.

---

## Post-setup checklist

- [ ] Node 20+ installed (`node -v`)
- [ ] Issued key created on the Developers page
- [ ] Host config uses `npx -y @buildaureon/mcp` (or local `node dist/index.js` with a placeholder cwd)
- [ ] `AUREON_API_KEY` set in host `env` (no private key)
- [ ] `AUREON_API_URL` omitted or set to `https://api.aureonlabs.network`
- [ ] Host restarted; aureon server shows connected
- [ ] `aureon_ping` succeeds
- [ ] `aureon_me` returns the expected wallet
- [ ] You know where [./tools.md](./tools.md) and [./agent-guide.md](./agent-guide.md) live for the next workflow

---

## Next steps

1. Read [./auth.md](./auth.md) if you need Bearer sessions or conflict rules.
2. Skim [./tools.md](./tools.md) for argument schemas.
3. Follow a playbook in [./agent-guide.md](./agent-guide.md).
4. Review trust boundaries in [./architecture.md](./architecture.md) and [./security.md](./security.md).

Package overview and ecosystem diagram: [../README.md](../README.md).
