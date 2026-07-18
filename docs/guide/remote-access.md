---
title: Remote access
---

# Remote access (Service API Token + LAN / local HTTPS)

> Hub 业务 API（Hub RPC `POST|WS /hub/rpc/v1` + MCP）须带 **per-subject Service API Token**（`Authorization: Bearer fa_at_...` 或 WS `connect.auth_token`）。
> Security context: [`security.md`](security.md) · Install: [`install.md`](install.md)

## Overview

| Layer                    | Role                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Service API Token**    | 绑定 `user` / `agent` subject；Hub RPC HTTP `Authorization: Bearer`；WS `connect.auth_token`；MCP `/mcp` 同 Bearer                 |
| **CLI bootstrap**        | `anima token create --subject-id <id> --name bootstrap`（直连 PG，不经 HTTP）                                                      |
| **`http.host`**          | Hub listen bind (IP or resolvable hostname); default `127.0.0.1`; use `0.0.0.0` for LAN                                            |
| **`http.allowed_hosts`** | TLS 证书 SAN 额外主机名 / IP（`http.host: 0.0.0.0` 时列出客户端访问用的名称）；变更后 `auto: true` 时重启自动重签                  |
| **`http.cors_origins`**  | Explicit cross-origin browser origins (dev:web, split UI/API reverse proxy)                                                        |
| **Client settings**      | Desktop / mobile shell / **browser Web** fill Hub URL and token in **Hub settings**                                                |
| **Remote UI**            | 浏览器/PWA 从 Hub `/web/*` 加载；Desktop/Mobile 默认安装包内本地 UI；见 [`architecture.md`](../concepts/architecture.md) Client UI |
| **PWA**                  | `/web/*` 支持 manifest + Service Worker；手机浏览器与 APK 共用 compact 布局                                                        |

公网暴露不在产品内置范围内：请使用局域网、`http.tls` 本地 HTTPS，或自行搭建反向代理 / VPN。旧版 `tunnel` 配置段已废弃并忽略。

### PWA（浏览器 Web）

- **Secure context**：Service Worker 需要 HTTPS 或 `localhost`。局域网可用 Hub 本地 HTTPS（`:2659`）或自建 TLS 终止。浏览器 **Web Speech** 朗读同样需安全上下文；默认 **Edge TTS**（Hub `POST /hub/rpc/v1/tts/synthesize`）在 HTTP 局域网下也可用，但 Hub 需能访问外网 Microsoft 语音服务。
- **Service Worker vs 安装**：SW 在普通浏览器标签页访问 `/web/*` 时即注册（生产构建）；**不要求**「添加到主屏幕」。安装仅改变启动方式（独立窗口），离线能力与标签页相同。
- **安装（可选）**：手机浏览器访问 `/web/chat`，Chrome / Safari 支持「添加到主屏幕」；生产构建会显示安装引导条（compact 布局、非已安装态）。
- **更新**：Hub 部署新 Web 静态产物后，已安装 PWA 会提示「新版本可用」；点击重新加载后生效（不会自动刷新）。壳层 JS 由 Workbox precache，生产环境会定期/`visibilitychange` 时 `registration.update()`。`/web/config.json` 始终 `no-store`（Hub URL 动态）。Desktop/Mobile 不走 SW；升级见 Releases 安装包检测（设置 → 关于「检查更新」）。
- **离线边界（两层）**：
  - **壳层（SW）**：仅缓存 JS/CSS/HTML 等静态资源，保证断网时页面框架可加载。
  - **业务快照（IndexedDB）**：Chat / Task / Project / Notification / Diary / Email / Dream / Pomodoro（config/历史）及 Console 部分只读页由 `shell-sdk/offline-cache` 做 cache-first；**Tier 2 可写**模块（Diary、Task、Project、Chat send、Pomodoro outbox）离线可编辑，恢复在线后 outbox flush；详见 [`offline-platform.md`](offline-platform.md)。
- **离线边界**：浏览器 `offline` 时 Tier 1 模块只读展示快照；**offlineWritable** 模块（Diary、Task、Project、Chat、Pomodoro）仍可本地编辑并排队待同步。
- **存储**：SW 缓存、localStorage（Hub 设置）、IndexedDB（业务快照）互不冲突；清除站点数据会同时删除三者。

Registry 标记 `auth: optional` 的 Hub RPC 方法（如 `health.probe`、`tls.ca.*`）与 CORS 预检可不带 Bearer；其余 `/hub/rpc/v1/*` 与 MCP 须 Bearer。

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

Console Hub RPC REST（需已认证 `full` token）：

- `GET /hub/rpc/v1/tokens/listForSubject?id=:id`（或 `hub().call("tokens.listForSubject", { id })`）
- `POST /hub/rpc/v1/tokens/createForSubject` — body `{ "id": <subject_id>, "name": "desktop" }`，响应含一次性 `plaintext`
- `POST /hub/rpc/v1/tokens/revoke` — body `{ "id": <token_id> }`

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

LAN: `http://<PC-IP>:2658/web/chat` with `http.host: 0.0.0.0` (or `anima service start --host 0.0.0.0`); clients set Hub URL to `http://<PC-IP>:2658` (no `/web` suffix).

### Cross-origin (`http.cors_origins`)

When the browser UI and Hub API share the same origin (e.g. Hub `/web` + same-host `/api`), **no CORS config is needed**.

Add origins only for **cross-origin** cases (e.g. Vite dev server, external reverse proxy splitting UI and API):

```yaml
http:
  cors_origins:
    - http://127.0.0.1:4173
```

CORS is **not** derived from `web.public_url`.

### Hub 本地 HTTPS（双端口，可选）

Hub 可在 **独立端口** 提供原生 TLS（`Bun.serve`），与默认 HTTP 并行：

| 端口     | 协议  | 用途                                                                                  |
| -------- | ----- | ------------------------------------------------------------------------------------- |
| **2658** | HTTP  | 默认；CLI 探活、日常客户端、局域网访问                                                |
| **2659** | HTTPS | 本地/局域网安全上下文（Web Speech / PWA 等）；客户端 Hub URL 填 `https://<host>:2659` |

启用（`~/.anima/config.yaml` bootstrap 段）：

```yaml
http:
  host: 0.0.0.0
  allowed_hosts:
    - feng-vm.lan
    - 10.200.200.10
  tls:
    enabled: true
    port: 2659
    auto: true
```

- **`auto: true`**（默认）：首次启动在 `~/.anima/tls/` 自动生成 cert/key（优先 **mkcert**，否则 **openssl 自签**）；SAN 含 `localhost`、`127.0.0.1`、`::1`、`http.host` 中的 bind 地址（跳过 `0.0.0.0`）及 **`http.allowed_hosts`**。配置变更导致 SAN 不足时，**重启 Hub 会自动删除旧证书并重签**（`auto: false` 时仅告警，不覆盖手动证书）。
- **探活**：`anima service status` 与 `GET /hub/rpc/v1/health/probe` 仍走 HTTP `:2658`。

#### mkcert root CA on clients (optional)

The Hub server certificate lives on the Hub host. Browsers, **desktop shell**, and mobile APKs need the **mkcert root CA** (`rootCA.pem`, not `cert.pem`) in the OS trust store for HTTPS `:2659` without warnings:

- **Settings → Connection** (`/web/settings?section=hub`): download **rootCA.pem** and a **QR code** (QR points at the HTTP `:2658` download URL so you can scan before trusting HTTPS).
- If HTTPS pages still fail to load scripts, open settings via **`http://<host>:2658/web/settings?section=hub`** first.

```bash
mkcert -CAROOT   # path to rootCA.pem on the Hub host
mkcert -install  # trust that CA on the Hub host itself
```

- **Desktop shell**: install `rootCA.pem` into the **OS** trust store (same machine as the desktop app). The Electron main process merges system CAs into Node TLS at startup so **Test connection** and companion Hub HTTPS/WSS match Chromium. On the Hub host after `mkcert -install`, no extra step is usually needed.
- **iOS**: AirDrop/email `rootCA.pem` → install the profile → **Settings → General → About → Certificate Trust Settings** → enable full trust.
- **Android**: optionally convert to DER, then **Settings → Security → Install CA certificate**. Capacitor APKs also need a build that trusts user CAs.

Daily LAN access: **HTTP `:2658`** or **HTTPS `:2659` (after CA trust)**; for the public Internet use your own reverse proxy or VPN.

## 2. Client configuration

**Desktop shell** (`src/app/shell/desktop`), **mobile shell** (`src/app/shell/mobile`), and **browser Web** are remote clients; they **do not read** Hub `config.yaml` token.

| Client        | Storage                                          |
| ------------- | ------------------------------------------------ |
| Desktop shell | `~/.anima-desktop/settings.json` (`hub` section) |
| Mobile shell  | Capacitor Preferences                            |
| Browser Web   | localStorage (settings page)                     |

Settings (all clients):

1. **Hub URL** — e.g. `http://192.168.1.10:2658` or `https://<lan-host>:2659` (Hub root, **without** `/web`)
2. **Hub API Token** — `fa_at_...` from `anima token create`

Browser Web: `/web/config.json` defaults Hub to the **page origin** (production Hub-hosted `/web` and Vite `dev:web`). Source `dev:hub` writes `~/.anima/dev-web.token`; Vite injects it as `remote_auth_token` so the first visit need not paste a token. Production Hub never puts tokens in `config.json` — use `anima token create` and Hub settings.

Flow: open Hub settings → fill → **Test connection** → Save. Desktop requires **restart desktop shell** after save.

## 3. Authentication behavior

```text
REST:  Authorization: Bearer fa_at_<prefix>_<secret>
Hub RPC: WebSocket /hub/rpc/v1 → connect frame includes auth_token
MCP:   POST/GET /mcp → Authorization: Bearer <token>
```

`/web/*` static assets skip service auth; `/api` and `/mcp` require Bearer token.

Missing or invalid token → HTTP `401` or Hub RPC connection closed.

## 4. MCP outbound (external agents query Hub data)

Hub serves Streamable HTTP MCP Server at **`/mcp`**, exposing read-only tools from ToolSets with `expose_mcp: true` (e.g. `memory_recall`, `conversation_search`). External MCP clients (Cursor, Claude Desktop, etc.) connect **without LLM relay**.

```yaml
# External agent example (Cursor mcp.json, etc.)
mcpServers:
  freeanima:
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer fa_at_..."
```

- **Inbound** (Hub connects to external MCP servers): `config.yaml` `mcp_servers` (`src/capabilities/mcp-client`)
- **Outbound** (external agents call Hub tools): `/mcp` endpoint (`src/capabilities/mcp-server`)

## Operations

| Command                          | Description                                  |
| -------------------------------- | -------------------------------------------- |
| `anima token create/list/revoke` | Service API Token 管理（CLI，直连 PG）       |
| `anima web start --foreground`   | Standalone Web static server (debug, `/web`) |
| `anima service status`           | Hub stack status                             |

## Troubleshooting

| Symptom                | Check                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| Cannot reach Hub       | Is Hub running? `anima service status`; check `http.host` / firewall |
| 401                    | Client token valid; run `anima token list --subject-id <id>`         |
| Local OK, remote fails | Remote requests need Bearer / SAP auth_token                         |
| CORS error in browser  | Add UI origin to `http.cors_origins`, or use Hub `/web` same-origin  |
| 401 after token change | Update client settings; revoke old tokens if needed                  |

## Related docs

- Mobile: [`mobile-app.md`](../features/mobile-app.md)
- Desktop companion Hub source: [`companion.md`](../features/companion.md)
