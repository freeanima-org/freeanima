---
title: Remote access
---

# Remote access (Service API Token + LAN / local HTTPS)

> Habitat 业务 API（Habitat RPC `POST|WS /rpc/v1` + MCP）须带 **per-subject Service API Token**（`Authorization: Bearer fa_at_...` 或 WS `connect.auth_token`）。
> Security context: [`security.md`](security.md) · Install: [`install.md`](install.md)

## Overview

| Layer                    | Role                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Service API Token**    | 绑定 `user` / `agent` subject；Habitat RPC HTTP `Authorization: Bearer`；WS `connect.auth_token`；MCP `/mcp` 同 Bearer                |
| **CLI bootstrap**        | `anima token create --subject-id <id> --name bootstrap`（直连 PG，不经 HTTP）                                                         |
| **`http.host`**          | Habitat listen bind (IP or resolvable hostname); default `127.0.0.1`; use `0.0.0.0` for LAN                                           |
| **`http.port`**          | HTTP 监听端口（默认 **2658**）；CLI `--port` 优先                                                                                     |
| **`http.tls.port`**      | HTTPS 监听端口（默认 **2659**）                                                                                                       |
| **`http.allowed_hosts`** | TLS 证书 SAN 额外主机名 / IP（`http.host: 0.0.0.0` 时列出）；`mode=mkcert` 时变更后重启自动重签                                       |
| **`http.tls.mode`**      | 证书来源：`mkcert`（默认）/ `acme` / `manual`                                                                                         |
| **`http.tls.acme`**      | `mode=acme` 时必填：Let's Encrypt HTTP-01（email + domains）                                                                          |
| **Client settings**      | Desktop / mobile shell / **browser Web** fill Habitat URL and token in **Habitat settings**                                           |
| **Remote UI**            | 浏览器/PWA 从 Habitat `/web/*` 加载；Desktop/Mobile 默认安装包内本地 UI；见 [`architecture.md`](../product/architecture.md) Client UI |
| **PWA**                  | `/web/*` 支持 manifest + Service Worker；布局跟视口（phone ≠ 必 compact；宽屏可为 expanded）                                          |

默认仍建议局域网、`http.tls.mode: mkcert`、VPN 或反向代理。可选 `mode: acme`（Let's Encrypt HTTP-01）便于有公网域名的部署；**不替代** harden / WAF / 最小暴露面。旧版 `tunnel` 配置段已废弃并忽略。

### PWA（浏览器 Web）

- **Secure context**：Service Worker 需要 HTTPS 或 `localhost`。局域网可用 Habitat 本地 HTTPS（`:2659`）或自建 TLS 终止。浏览器 **Web Speech** 朗读同样需安全上下文；默认 **Edge TTS**（Habitat `POST /rpc/v1/tts/synthesize`）在 HTTP 局域网下也可用，但 Habitat 需能访问外网 Microsoft 语音服务。
- **Service Worker vs 安装**：SW 在普通浏览器标签页访问 `/web/*` 时即注册（生产构建）；**不要求**「添加到主屏幕」。安装仅改变启动方式（独立窗口），离线能力与标签页相同。
- **安装（可选）**：手机浏览器访问 `/web/chat`，Chrome / Safari 支持「添加到主屏幕」；生产构建会显示安装引导条（compact 布局、非已安装态）。
- **更新**：Habitat 部署新 Web 静态产物后，已安装 PWA 会提示「新版本可用」；点击重新加载后生效（不会自动刷新）。壳层 JS 由 Workbox precache，生产环境会定期/`visibilitychange` 时 `registration.update()`。`/web/config.json` 始终 `no-store`（Habitat URL 动态）。Desktop/Mobile 不走 SW；升级见 Releases 安装包检测（设置 → 关于「检查更新」）。
- **离线边界（两层）**：
  - **壳层（SW）**：仅缓存 JS/CSS/HTML 等静态资源，保证断网时页面框架可加载。
  - **业务快照（IndexedDB）**：Chat / Task / Project / Notification / Diary / Email / Dream / Pomodoro（config/历史）及 Habitat UI 部分只读页由 `portal-sdk/offline-cache` 做 **在线栖息地优先 / 离线 snapshot**；**outbox 模块**（Diary、Task、Project）在线写直连 Habitat（`preferOnlineWrite`），离线或网络失败走 outbox；Chat send / Pomodoro 仍有各自 outbox 路径；详见 [`offline-platform.md`](../aspects/offline-platform.md)（总览见 [Portal data plane](../aspects/portal-data-plane.md)）。
- **离线边界**：浏览器 `offline` 时 snapshot 模块只读展示快照；**offlineWritable** 模块（Diary、Task、Project、Chat、Pomodoro）仍可本地编辑并排队待同步。
- **存储**：SW 缓存、localStorage（Habitat 设置）、IndexedDB（业务快照）互不冲突；清除站点数据会同时删除三者。

Registry 标记 `auth: optional` 的 Habitat RPC 方法（如 `health.probe`、`tls.ca.*`）与 CORS 预检可不带 Bearer；其余 `/rpc/v1/*` 与 MCP 须 Bearer。

## 1. 创建 token（冷启动）

```bash
anima token create --subject-id 1 --name bootstrap
# 终端打印 fa_at_...（仅此一次）→ 填入客户端 Habitat 设置
```

列出 / 撤销：

```bash
anima token list --subject-id 1
anima token revoke <token_id>
```

Habitat Habitat RPC REST（需已认证 `full` token）：

- `GET /rpc/v1/tokens/listForSubject?id=:id`（或 `createTypedHabitatClient().call("tokens.listForSubject", { id })`）
- `POST /rpc/v1/tokens/createForSubject` — body `{ "id": <subject_id>, "name": "desktop" }`，响应含一次性 `plaintext`
- `POST /rpc/v1/tokens/revoke` — body `{ "id": <token_id> }`

### Listen address (`http.host`)

Default bind is `127.0.0.1:2658` (loopback only). For LAN access via `http://<PC-IP>:2658/web` or a local hostname such as `http://galaxy:2658/web`, set:

```yaml
http:
  host: 0.0.0.0
```

Multiple binds (distinct interfaces only — not client-facing aliases). Use `0.0.0.0` instead of listing every IP; do not mix `0.0.0.0` with specific addresses. Hostnames must resolve on the Habitat machine (`/etc/hosts` or DNS):

```yaml
http:
  host:
    - 127.0.0.1
    - 10.244.0.2
```

CLI `--host` overrides config for a single run / systemd unit write. After changing `http.host`, run `anima service restart`.

LAN: `http://<PC-IP>:2658/web/chat` with `http.host: 0.0.0.0` (or `anima service start --host 0.0.0.0`); clients set Habitat URL to `http://<PC-IP>:2658` (no `/web` suffix).

Browser UI should use **same origin** as Habitat API（Habitat `/web`，或 Vite 代理到本机 Habitat）。跨源浏览器 UI 不再支持可配置 CORS；桌面壳本机 loopback / Tauri origin 仍内置放行。

### Habitat 本地 HTTPS（双端口，可选）

Habitat 可在 **独立端口** 提供原生 TLS（`Bun.serve`），与默认 HTTP 并行：

| 端口     | 协议  | 用途                                                                                      |
| -------- | ----- | ----------------------------------------------------------------------------------------- |
| **2658** | HTTP  | 默认；CLI 探活、日常客户端、局域网访问                                                    |
| **2659** | HTTPS | 本地/局域网安全上下文（Web Speech / PWA 等）；客户端 Habitat URL 填 `https://<host>:2659` |

启用（`~/.anima/config.yaml` bootstrap 段）：

```yaml
http:
  host: 0.0.0.0
  port: 2658
  allowed_hosts:
    - feng-vm.lan
    - 10.200.200.10
  tls:
    enabled: true
    port: 2659
    mode: mkcert
```

- **`http.port`** / **`http.tls.port`**：分别配置 HTTP 与 HTTPS 端口（默认 2658 / 2659）。CLI `--port` 覆盖 `http.port`。
- **`mode: mkcert`**（默认）：首次启动在 `~/.anima/tls/` 自动生成 cert/key（优先 **mkcert**，否则 **openssl 自签**）；SAN 含 `localhost`、`127.0.0.1`、`::1`、`http.host` 中的 bind 地址（跳过 `0.0.0.0`）及 **`http.allowed_hosts`**。配置变更导致 SAN 不足时，**重启 Habitat 会自动删除旧证书并重签**。
- **`mode: manual`**：须指定 `cert` / `key`（可选 `passphrase`）；不自动重签。
- **探活**：`anima service status` 与 `GET /rpc/v1/health/probe` 仍走 HTTP（默认 `:2658`）。

#### 可选：Let's Encrypt（公网域名）

有公网 IP、且域名 A/AAAA 指向本机时，可在 bootstrap 配置 ACME（**HTTP-01**，默认监听 **:80**）：

```yaml
http:
  host: 0.0.0.0
  tls:
    enabled: true
    port: 2659
    mode: acme
    acme:
      email: you@example.com
      domains:
        - anima.example.com
      # challenge_port: 80
      # staging: false   # 调试时可 true（LE staging）
```

- 证书写入 `~/.anima/tls/cert.pem` + `key.pem`（fullchain）；账号存 `~/.anima/tls/acme-account.json`（0600）。
- 启动时若证书覆盖 `domains` 且剩余有效期 **> 30 天** 则复用；否则签发/续期。进程内约每 12h 检查，续期成功后重载 HTTPS `:2659`（HTTP `:2658` 与 challenge 服不变）。
- Let's Encrypt **不签裸 IP**；客户端用 `https://<domain>:2659`（或自行反代到 443）。公信 CA，**无需**安装 mkcert 根 CA。
- `:80` 须公网可达（常见需 root / `CAP_NET_BIND_SERVICE`，或确保端口未被占用）。

#### mkcert root CA on clients (optional)

The Habitat server certificate lives on the Habitat host. Browsers, **desktop shell**, and mobile APKs need the **mkcert root CA** (`rootCA.pem`, not `cert.pem`) in the OS trust store for HTTPS `:2659` without warnings（**Let's Encrypt 证书跳过本步**）：

- **设置 → 连接** (`/web/settings?section=habitat`): download **rootCA.pem** and a **QR code** (QR points at the HTTP `:2658` download URL so you can scan before trusting HTTPS).
- If HTTPS pages still fail to load scripts, open settings via **`http://<host>:2658/web/settings?section=habitat`** first.

```bash
mkcert -CAROOT   # path to rootCA.pem on the Habitat host
mkcert -install  # trust that CA on the Habitat host itself
```

- **Desktop shell**: install `rootCA.pem` into the **OS** trust store (same machine as the desktop app). Install the CA into the OS trust store so Tauri WebView **and** shell native HTTP (`probe_habitat_health` via `reqwest` + OS roots) trust Habitat HTTPS. On the Habitat host after `mkcert -install`, no extra step is usually needed. If the system browser reaches `https://…:2659` but the shell「测试连接」fails with a TLS/certificate error, treat it as a shell TLS-trust bug (native HTTP must use the OS trust store), not “CA not installed”.
- **iOS**: AirDrop/email `rootCA.pem` → install the profile → **Settings → General → About → Certificate Trust Settings** → enable full trust.
- **Android**: optionally convert to DER, then **Settings → Security → Install CA certificate**. Tauri Android builds also need a build that trusts user CAs.

Daily LAN access: **HTTP `:2658`** or **HTTPS `:2659` (after CA trust for mkcert)**。公网域名 + `mode: acme`：`https://<domain>:2659`。仍可用反向代理或 VPN 做 harden。

## 2. Client configuration

**Portal** (`src/portal/app/tauri`) and **browser Web** (`src/portal/app/web`) are remote clients; they **do not read** Habitat `config.yaml` token.

| Client           | Storage                                              |
| ---------------- | ---------------------------------------------------- |
| Desktop shell    | `~/.anima-desktop/settings.json` (`habitat` section) |
| Mobile shell     | Tauri prefs / store                                  |
| Browser Web      | localStorage (settings page)                         |
| Vault 浏览器扩展 | 扩展选项页 → `chrome.storage.local`                  |

Settings (all clients):

1. **Habitat URL** — e.g. `http://192.168.1.10:2658` or `https://<lan-host>:2659` (Habitat root, **without** `/web`)
2. **Habitat API Token** — `fa_at_...` from `anima token create`

Browser Web: `/web/config.json` defaults Habitat to the **page origin** (production Habitat-hosted `/web` and Vite `just dev web`). Source `just dev habitat` writes `~/.anima/dev-web.token`; Vite injects it as `remote_auth_token` so the first visit need not paste a token. Production Habitat never puts tokens in `config.json` — use `anima token create` and Habitat settings.

Flow: open Habitat settings → fill → **Test connection** → Save. Desktop requires **restart desktop shell** after save.

**Vault 浏览器扩展（浏览器形态入口）：** 选项页填写同一组 URL + Token → 测试连接 → 用用户库主密码解锁。RPC 仅 HTTP REST（background）；见 [`docs/modules/portal.md`](../modules/portal.md)、[`docs/modules/vault.md`](../modules/vault.md)（`just pack browser-extension`）。

## 3. Authentication behavior

```text
REST:  Authorization: Bearer fa_at_<prefix>_<secret>
Habitat RPC: WebSocket /rpc/v1 → connect frame includes auth_token
MCP:   POST/GET /mcp → Authorization: Bearer <token>
```

`/web/*` static assets skip service auth; `/api` and `/mcp` require Bearer token.

Missing or invalid token → HTTP `401` or Habitat RPC connection closed.

## 4. MCP outbound (external agents query Habitat data)

Habitat serves Streamable HTTP MCP Server at **`/mcp`**, exposing tools with `exposeMcp: true`. Current outbound surface is **task item** tools only (`task_*`: create/update/complete/uncomplete/delete/get/list/search); task lists, projects, and folders stay Habitat-only. Other ToolSets remain available inside Habitat chat but are not listed on `/mcp`. External MCP clients (Cursor, Claude Desktop, etc.) connect **without LLM relay**.

```yaml
# External agent example (Cursor mcp.json, etc.)
mcpServers:
  freeanima:
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer fa_at_..."
```

- **Inbound** (Habitat connects to external MCP servers): runtime `mcp_servers` (`src/host/capabilities/mcp-client`); manage in Habitat UI `/habitat/mcp`
- **Outbound** (external agents call Habitat tools): `/mcp` endpoint (`src/host/capabilities/mcp-server`)

## Operations

| Command                          | Description                            |
| -------------------------------- | -------------------------------------- |
| `anima token create/list/revoke` | Service API Token 管理（CLI，直连 PG） |
| `anima service status`           | Habitat stack status                   |

## Troubleshooting

| Symptom                | Check                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Cannot reach Habitat   | Is Habitat running? `anima service status`; check `http.host` / firewall               |
| 401                    | Client token valid; run `anima token list --subject-id <id>`                           |
| Local OK, remote fails | Remote requests need Bearer / SAP auth_token                                           |
| CORS error in browser  | Use Habitat `/web` same-origin (or Vite proxy); cross-origin browser UI is unsupported |
| 401 after token change | Update client settings; revoke old tokens if needed                                    |

## Related docs

- Mobile: [`mobile-app.md`](../modules/mobile-app.md)
- Desktop companion Habitat source: [`companion.md`](../modules/companion.md)
