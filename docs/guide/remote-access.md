---
title: Remote access
---

# Remote access (Tunnel + app token)

> When exposing the home PC Hub via **Cloudflare Tunnel**, Hub **`remote_auth`** Bearer token protects non-local connections.
> Security context: [`security.md`](security.md) · Install: [`install.md`](install.md)

## Overview

| Layer                   | Role                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Hub `remote_auth`**   | Plaintext token in `config.yaml`; REST `Authorization: Bearer`; SAP `connect` frame `auth_token`; MCP `/mcp` same Bearer |
| **cloudflared**         | Outbound tunnel; single hostname → Hub `127.0.0.1:2658` (API + Web UI at `/web`)                                         |
| **`http.cors_origins`** | Explicit cross-origin browser origins (dev:web, split UI/API reverse proxy); independent of Tunnel                       |
| **Client settings**     | app/desktop / app/mobile / **browser Web** fill Hub URL and token in **Hub settings**                                    |

Token is **skipped** only when **Host is loopback** (`127.0.0.1` / `localhost` / `::1`) **and TCP peer is loopback** (local dev, CLI/systemd health checks). Public domains (via Tunnel), LAN IPs, etc. require token; independent of `tunnel.enabled`.

## 1. Hub configuration

In `~/.anima/config.yaml` (**omit for local-only**; required before LAN or public exposure):

```yaml
remote_auth:
  token: "replace with openssl rand -base64 32 output"
```

Generate:

```bash
openssl rand -base64 32
```

`.gitignore` ignores `config.yaml`; do not commit. Admin API redacts `remote_auth.token` on read.

### Cross-origin (`http.cors_origins`)

When the browser UI and Hub API share the same origin (default: `https://anima.example.com/web` + `https://anima.example.com/api`), **no CORS config is needed**.

Add origins only for **cross-origin** cases (e.g. Vite dev server, external reverse proxy splitting UI and API):

```yaml
http:
  cors_origins:
    - http://127.0.0.1:4173
```

CORS is **not** derived from `tunnel` or `web.public_url`.

## 2. Tunnel (optional)

```bash
anima tunnel setup
anima service start
```

When `tunnel.enabled: true`, cloudflared starts with **`anima service start`** stack (no separate `anima-tunnel.service`). Ingress points to Hub `:2658` only; Web UI is served at **`/web`** on the same hostname.

```yaml
tunnel:
  enabled: true
  hostname: anima.example.com

web:
  enabled: true
  public_url: https://anima.example.com/web
```

Browser: `https://anima.example.com/web/chat` · Hub API: `https://anima.example.com/api`

Without Tunnel, LAN: `http://<PC-IP>:2658/web/chat` with `anima service start --host 0.0.0.0`; clients set Hub URL to `http://<PC-IP>:2658` (no `/web` suffix).

### Cloudflare credentials (pass)

| pass path                                | Purpose                       |
| ---------------------------------------- | ----------------------------- |
| `services/cloudflare/api-token`          | Create Tunnel / DNS           |
| `services/cloudflare/tunnel-credentials` | `cloudflared` connector creds |

See wizard `anima tunnel setup`.

## 3. Client configuration

**app/desktop**, **app/mobile**, and **browser Web** are remote clients; they **do not read** Hub `config.yaml` token.

| Client      | Storage                                          |
| ----------- | ------------------------------------------------ |
| app/desktop | `~/.anima-desktop/settings.json` (`hub` section) |
| app/mobile  | Capacitor Preferences                            |
| Browser Web | localStorage (settings page)                     |

Settings (all clients):

1. **Hub URL** — e.g. `https://anima.example.com` or `http://192.168.1.10:2658` (Hub root, **without** `/web`)
2. **Remote token** — same as Hub `remote_auth.token` (required for LAN IP / domain; only loopback may omit)

Browser Web: `/web/config.json` sets default Hub to the page origin; first visit still requires saving token in settings.

Flow: open Hub settings → fill → **Test connection** → Save. Desktop requires **restart app/desktop** after save.

## 4. Authentication behavior

```text
REST:  Authorization: Bearer <token>
SAP:   WebSocket /sap/v1 → connect frame includes auth_token
MCP:   POST/GET /mcp → Authorization: Bearer <token>
```

`/web/*` static assets skip `remote_auth`; `/api` and `/mcp` do not.

## 5. MCP outbound (external agents query Hub data)

Hub serves Streamable HTTP MCP Server at **`/mcp`**, exposing read-only tools from ToolSets with `expose_mcp: true` (e.g. `memory_recall`, `conversation_search`). External MCP clients (Cursor, Claude Desktop, etc.) connect **without LLM relay**.

```yaml
# External agent example (Cursor mcp.json, etc.)
mcpServers:
  freeanima:
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer <remote_auth.token>"
```

- **Inbound** (Hub connects to external MCP servers): `config.yaml` `mcp_servers` (`capabilities/mcp-client`)
- **Outbound** (external agents call Hub tools): `/mcp` endpoint (`capabilities/mcp-server`)
- Public / LAN access requires same `remote_auth` token as REST; loopback may omit

Missing or wrong token → HTTP `401` or SAP connection closed.

Decision uses request URL **Host** (public domain via Tunnel, e.g. `anima.example.com`) and **TCP peer**; Hub does not use `tunnel.enabled` to decide token enforcement.

## Operations

| Command                        | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `anima tunnel status`          | Tunnel / cloudflared status                    |
| `anima tunnel start` / `stop`  | Manual cloudflared (production: service stack) |
| `anima web start --foreground` | Standalone Web static server (debug, `/web`)   |
| `anima service status`         | Hub / Tunnel stack                             |

## Troubleshooting

| Symptom                | Check                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Public 502             | Is Hub running? `anima service status`                                   |
| Public 1033            | `anima tunnel status` shows `connected: no`                              |
| 401                    | Client token matches `remote_auth.token`                                 |
| Local OK, remote fails | Remote requests need Bearer / SAP auth_token; public Host requires token |
| CORS error in browser  | Add UI origin to `http.cors_origins`, or use Hub `/web` same-origin      |
| 401 after token change | Update Hub config **and** all client settings pages                      |

## Related docs

- Mobile: [`mobile-app.md`](../features/mobile-app.md)
- Desktop companion Hub source: [`companion.md`](../features/companion.md)
