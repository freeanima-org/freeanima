---
title: Remote access
---

# Remote access (Tunnel + Service API Token)

> Hub 业务 API（REST / SAP / MCP）须带 **per-subject Service API Token**（`Authorization: Bearer fa_at_...`）。
> Security context: [`security.md`](security.md) · Install: [`install.md`](install.md)

## Overview

| Layer                   | Role                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Service API Token**   | 绑定 `user` / `agent` subject；REST `Authorization: Bearer`；SAP `connect.auth_token`；MCP `/mcp` 同 Bearer |
| **CLI bootstrap**       | `anima token create --subject-id <id> --name bootstrap`（直连 PG，不经 HTTP）                               |
| **cloudflared**         | Outbound tunnel；single hostname → Hub `127.0.0.1:2658`（API + Web UI at `/web`）                           |
| **`http.host`**         | Hub listen bind (IP or resolvable hostname); default `127.0.0.1`; use `0.0.0.0` for LAN                     |
| **`http.cors_origins`** | Explicit cross-origin browser origins (dev:web, split UI/API reverse proxy); independent of Tunnel          |
| **Client settings**     | app/desktop / app/mobile / **browser Web** fill Hub URL and token in **Hub settings**                       |
| **Remote UI**           | Desktop / Mobile 默认从 Hub `/web/*` 加载 UI；见 [`architecture.md`](../concepts/architecture.md) Client UI |
| **PWA**                 | `/web/*` 支持 manifest + Service Worker；手机浏览器与 APK 共用 compact 布局                                 |

### PWA（浏览器 Web）

- **Secure context**：Service Worker 需要 HTTPS 或 `localhost`；Tunnel 终端应使用 HTTPS 域名。
- **安装**：手机浏览器访问 `/web/chat`，Chrome / Safari 支持「添加到主屏幕」；生产构建会显示安装引导条（compact 布局、非已安装态）。
- **更新**：Hub 部署新 Web 静态产物后，已安装 PWA 会提示「新版本可用」；点击重新加载后生效。壳层 JS 由 Workbox precache，`/web/config.json` 始终 `no-store`（Hub URL 动态）。
- **离线边界**：SW 仅缓存壳层静态资源（JS/CSS/HTML）；会话/任务等数据由应用层 IndexedDB（`shell-sdk/offline-cache`）只读回退，**不**缓存 `/api` 或 `/sap`。
- **存储**：PWA 与 localStorage（Hub 设置）、IndexedDB（业务快照）互不冲突；清除站点数据会同时删除三者。

仅 `GET /api/health`、CORS 预检、`/api/echo` 豁免认证。

## 1. 创建 token（冷启动）

```bash
anima token create --subject-id 1 --name bootstrap
# 终端打印 fa_at_...（仅此一次）→ 填入客户端 Hub 设置
```

列出 / 撤销：

```bash
anima token list --subject-id 1
anima token revoke <token_id>
```

Admin REST（需已认证 `full` token）：

- `GET /api/subjects/:id/tokens`
- `POST /api/subjects/:id/tokens` — body `{ "name": "desktop" }`，响应含一次性 `plaintext`
- `DELETE /api/tokens/:id`

### Listen address (`http.host`)

Default bind is `127.0.0.1:2658` (loopback only). For LAN access via `http://<PC-IP>:2658/web` or a local hostname such as `http://galaxy:2658/web`, set:

```yaml
http:
  host: 0.0.0.0
```

Multiple binds (distinct interfaces only — not client-facing aliases). Use `0.0.0.0` instead of listing every IP; do not mix `0.0.0.0` with specific addresses. Hostnames must resolve on the Hub machine (`/etc/hosts` or DNS):

```yaml
http:
  host:
    - 127.0.0.1
    - 10.244.0.2
```

CLI `--host` overrides config for a single run / systemd unit write. After changing `http.host`, run `anima service restart`.

Without Tunnel, LAN: `http://<PC-IP>:2658/web/chat` with `http.host: 0.0.0.0` (or `anima service start --host 0.0.0.0`); clients set Hub URL to `http://<PC-IP>:2658` (no `/web` suffix).

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

Without Tunnel, LAN: `http://<PC-IP>:2658/web/chat` with `http.host: 0.0.0.0` in config (see above); clients set Hub URL to `http://<PC-IP>:2658` (no `/web` suffix).

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
2. **Hub API Token** — `fa_at_...` from `anima token create`

Browser Web: `/web/config.json` sets default Hub to the page origin; first visit still requires saving token in settings.

Flow: open Hub settings → fill → **Test connection** → Save. Desktop requires **restart app/desktop** after save.

## 4. Authentication behavior

```text
REST:  Authorization: Bearer fa_at_<prefix>_<secret>
SAP:   WebSocket /sap/v1 → connect frame includes auth_token
MCP:   POST/GET /mcp → Authorization: Bearer <token>
```

`/web/*` static assets skip service auth; `/api` and `/mcp` require Bearer token.

Missing or invalid token → HTTP `401` or SAP connection closed.

## 5. MCP outbound (external agents query Hub data)

Hub serves Streamable HTTP MCP Server at **`/mcp`**, exposing read-only tools from ToolSets with `expose_mcp: true` (e.g. `memory_recall`, `conversation_search`). External MCP clients (Cursor, Claude Desktop, etc.) connect **without LLM relay**.

```yaml
# External agent example (Cursor mcp.json, etc.)
mcpServers:
  freeanima:
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer fa_at_..."
```

- **Inbound** (Hub connects to external MCP servers): `config.yaml` `mcp_servers` (`capabilities/mcp-client`)
- **Outbound** (external agents call Hub tools): `/mcp` endpoint (`capabilities/mcp-server`)

## Operations

| Command                          | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| `anima token create/list/revoke` | Service API Token 管理（CLI，直连 PG）         |
| `anima tunnel status`            | Tunnel / cloudflared status                    |
| `anima tunnel start` / `stop`    | Manual cloudflared (production: service stack) |
| `anima web start --foreground`   | Standalone Web static server (debug, `/web`)   |
| `anima service status`           | Hub / Tunnel stack                             |

## Troubleshooting

| Symptom                | Check                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| Public 502             | Is Hub running? `anima service status`                              |
| Public 1033            | `anima tunnel status` shows `connected: no`                         |
| 401                    | Client token valid; run `anima token list --subject-id <id>`        |
| Local OK, remote fails | Remote requests need Bearer / SAP auth_token                        |
| CORS error in browser  | Add UI origin to `http.cors_origins`, or use Hub `/web` same-origin |
| 401 after token change | Update client settings; revoke old tokens if needed                 |

## Related docs

- Mobile: [`mobile-app.md`](../features/mobile-app.md)
- Desktop companion Hub source: [`companion.md`](../features/companion.md)
