---
title: 远程访问
---

# 远程访问（Service API Token + 局域网 / 本机 HTTPS）

> 栖息地业务 API（栖息地 RPC `POST|WS /rpc/v1` + MCP）须带 **按 subject 的 Service API Token**（`Authorization: Bearer fa_at_...` 或 WS `connect.auth_token`）。
> 安全上下文：[`security.md`](security.md) · 安装：[`install.md`](install.md)

## 概述

| 层                       | 作用                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Service API Token**    | 绑定 `user` / `agent` subject；栖息地 RPC HTTP `Authorization: Bearer`；WS `connect.auth_token`；MCP `/mcp` 同 Bearer               |
| **CLI 冷启动**           | `anima token create --subject-id <id> --name bootstrap`（直连 PG，不经 HTTP）                                                       |
| **`http.host`**          | 栖息地监听绑定（IP 或可解析主机名）；默认 `127.0.0.1`；局域网用 `0.0.0.0`                                                           |
| **`http.port`**          | HTTP 监听端口（默认 **2658**）；CLI `--port` 优先                                                                                   |
| **`http.tls.port`**      | HTTPS 监听端口（默认 **2659**）                                                                                                     |
| **`http.allowed_hosts`** | TLS 证书 SAN 额外主机名 / IP（`http.host: 0.0.0.0` 时列出）；`mode=mkcert` 时变更后重启自动重签                                     |
| **`http.tls.mode`**      | 证书来源：`mkcert`（默认）/ `acme` / `manual`                                                                                       |
| **`http.tls.acme`**      | `mode=acme` 时必填：Let's Encrypt HTTP-01（email + domains）                                                                        |
| **客户端设置**           | 桌面 / 移动壳 / **浏览器 Web** 在**栖息地设置**中填写栖息地 URL 与 token                                                            |
| **远程 UI**              | 浏览器/PWA 从栖息地 `/web/*` 加载；Desktop/Mobile 默认安装包内本地 UI；见 [`architecture.md`](../product/architecture.md) Client UI |
| **PWA**                  | `/web/*` 支持 manifest + Service Worker；布局跟视口（phone ≠ 必 compact；宽屏可为 expanded）                                        |

默认仍建议局域网、`http.tls.mode: mkcert`、VPN 或反向代理。可选 `mode: acme`（Let's Encrypt HTTP-01）便于有公网域名的部署；**不替代** harden / WAF / 最小暴露面。旧版 `tunnel` 配置段已废弃并忽略。

### PWA（浏览器 Web）

- **安全上下文**：Service Worker 需要 HTTPS 或 `localhost`。局域网可用栖息地本机 HTTPS（`:2659`）或自建 TLS 终止。浏览器 **Web Speech** 朗读同样需安全上下文；默认 **Edge TTS**（栖息地 `POST /rpc/v1/tts/synthesize`）在 HTTP 局域网下也可用，但栖息地需能访问外网 Microsoft 语音服务。
- **Service Worker vs 安装**：SW 在普通浏览器标签页访问 `/web/*` 时即注册（生产构建）；**不要求**「添加到主屏幕」。安装仅改变启动方式（独立窗口），离线能力与标签页相同。
- **安装（可选）**：手机浏览器访问 `/web/chat`，Chrome / Safari 支持「添加到主屏幕」；生产构建会显示安装引导条（compact 布局、非已安装态）。
- **更新**：栖息地部署新 Web 静态产物后，已安装 PWA 会提示「新版本可用」；点击重新加载后生效（不会自动刷新）。壳层 JS 由 Workbox precache，生产环境会定期/`visibilitychange` 时 `registration.update()`。`/web/config.json` 始终 `no-store`（栖息地 URL 动态）。Desktop/Mobile 不走 SW；升级见 Releases 安装包检测（设置 → 关于「检查更新」）。
- **离线边界（两层）**：
  - **壳层（SW）**：仅缓存 JS/CSS/HTML 等静态资源，保证断网时页面框架可加载。
  - **业务快照（IndexedDB）**：聊天室 / 任务 / 项目 / 通知 / 日记 / 邮件 / 梦境 / 番茄钟（config/历史）及栖息地 UI 部分只读页由 `portal-sdk/offline-cache` 做 **在线栖息地优先 / 离线 snapshot**；**outbox 模块**（日记、任务、项目）在线写直连栖息地（`preferOnlineWrite`），离线或网络失败走出盒；聊天室 send / 番茄钟仍有各自 outbox 路径；详见 [`offline-platform.md`](../aspects/offline-platform.md)（总览见 [Portal 数据面](../aspects/portal-data-plane.md)）。
- **离线边界**：浏览器 `offline` 时 snapshot 模块只读展示快照；**offlineWritable** 模块（日记、任务、项目、聊天室、番茄钟）仍可本地编辑并排队待同步。
- **存储**：SW 缓存、localStorage（栖息地设置）、IndexedDB（业务快照）互不冲突；清除站点数据会同时删除三者。

Registry 标记 `auth: optional` 的栖息地 RPC 方法（如 `health.probe`、`tls.ca.*`）与 CORS 预检可不带 Bearer；其余 `/rpc/v1/*` 与 MCP 须 Bearer。

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

栖息地 RPC REST（需已认证 `full` token）：

- `GET /rpc/v1/tokens/listForSubject?id=:id`（或 `createTypedHabitatClient().call("tokens.listForSubject", { id })`）
- `POST /rpc/v1/tokens/createForSubject` — body `{ "id": <subject_id>, "name": "desktop" }`，响应含一次性 `plaintext`
- `POST /rpc/v1/tokens/revoke` — body `{ "id": <token_id> }`

### 监听地址（`http.host`）

默认绑定 `127.0.0.1:2658`（仅 loopback）。若要经 `http://<PC-IP>:2658/web` 或本机主机名如 `http://galaxy:2658/web` 做局域网访问，设置：

```yaml
http:
  host: 0.0.0.0
```

多绑定（仅不同接口 —— 不是面向客户端的别名）。用 `0.0.0.0` 代替枚举每个 IP；不要把 `0.0.0.0` 与具体地址混用。主机名须在栖息地机器上可解析（`/etc/hosts` 或 DNS）：

```yaml
http:
  host:
    - 127.0.0.1
    - 10.244.0.2
```

CLI `--host` 覆盖单次运行 / systemd unit 写入的配置。变更 `http.host` 后执行 `anima service restart`。

局域网：`http.host: 0.0.0.0`（或 `anima service start --host 0.0.0.0`）时用 `http://<PC-IP>:2658/web/chat`；客户端栖息地 URL 设为 `http://<PC-IP>:2658`（不要加 `/web` 后缀）。

浏览器 UI 应与栖息地 API **同源**（栖息地 `/web`，或 Vite 代理到本机栖息地）。跨源浏览器 UI 不再支持可配置 CORS；桌面壳本机 loopback / Tauri origin 仍内置放行。

### 栖息地本机 HTTPS（双端口，可选）

栖息地可在**独立端口**提供原生 TLS（`Bun.serve`），与默认 HTTP 并行：

| 端口     | 协议  | 用途                                                                                    |
| -------- | ----- | --------------------------------------------------------------------------------------- |
| **2658** | HTTP  | 默认；CLI 探活、日常客户端、局域网访问                                                  |
| **2659** | HTTPS | 本地/局域网安全上下文（Web Speech / PWA 等）；客户端栖息地 URL 填 `https://<host>:2659` |

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
- **`mode: mkcert`**（默认）：首次启动在 `~/.anima/tls/` 自动生成 cert/key（优先 **mkcert**，否则 **openssl 自签**）；SAN 含 `localhost`、`127.0.0.1`、`::1`、`http.host` 中的 bind 地址（跳过 `0.0.0.0`）及 **`http.allowed_hosts`**。配置变更导致 SAN 不足时，**重启栖息地会自动删除旧证书并重签**。
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

#### 客户端上的 mkcert 根 CA（可选）

栖息地服务器证书在栖息地主机上。浏览器、**桌面壳**与移动 APK 需把 **mkcert 根 CA**（`rootCA.pem`，不是 `cert.pem`）装进 OS 信任库，才能无警告访问 HTTPS `:2659`（**Let's Encrypt 证书跳过本步**）：

- **设置 → 连接**（`/web/settings?section=habitat`）：打开 **局域网 TLS 证书** → 下载 **rootCA.pem** 与 **二维码**（二维码指向 HTTP `:2658` 下载 URL，便于在信任 HTTPS 之前扫描）。
- 若 HTTPS 页仍加载不了脚本，先经 **`http://<host>:2658/web/settings?section=habitat`** 打开设置。

```bash
mkcert -CAROOT   # path to rootCA.pem on the Habitat host
mkcert -install  # trust that CA on the Habitat host itself
```

- **桌面壳**：把 `rootCA.pem` 装进 **OS** 信任库（与桌面应用同一台机器）。装入 OS 信任库后，Tauri WebView **与** 壳原生 HTTP（`probe_habitat_health` 经 `reqwest` + OS 根证书）都会信任栖息地 HTTPS。栖息地主机上 `mkcert -install` 后通常无需额外步骤。若系统浏览器能打开 `https://…:2659` 但壳「测试连接」因 TLS/证书失败，按壳 TLS 信任 bug 处理（原生 HTTP 须用 OS 信任库），不是「未装 CA」。
- **iOS**：AirDrop/邮件发送 `rootCA.pem` → 安装描述文件 → **设置 → 通用 → 关于本机 → 证书信任设置** → 开启完全信任。
- **Android**：可选转为 DER，再 **设置 → 安全 → 安装 CA 证书**。Tauri Android 构建还需信任用户 CA 的构建。

日常局域网访问：**HTTP `:2658`** 或 **HTTPS `:2659`（mkcert 需先信任 CA）**。公网域名 + `mode: acme`：`https://<domain>:2659`。仍可用反向代理或 VPN 做 harden。

## 2. 客户端配置

**入口**（`src/portal/app/tauri`）与 **浏览器 Web**（`src/portal/app/web`）是远程客户端；它们**不读取**栖息地 `config.yaml` 的 token。

| 客户端           | 存储                                             |
| ---------------- | ------------------------------------------------ |
| 桌面壳           | `~/.anima-desktop/settings.json`（`habitat` 段） |
| 移动壳           | Tauri prefs / store                              |
| 浏览器 Web       | localStorage（设置页）                           |
| Vault 浏览器扩展 | 扩展选项页 → `chrome.storage.local`              |

设置（所有客户端）：

1. **栖息地 URL** — 例如 `http://192.168.1.10:2658` 或 `https://<lan-host>:2659`（栖息地根，**不要**带 `/web`）
2. **栖息地 API Token** — 来自 `anima token create` 的 `fa_at_...`

浏览器 Web：`/web/config.json` 默认把栖息地设为**页面 origin**（生产栖息地托管的 `/web` 与 Vite `just dev web`）。源码 `just dev habitat` 写入 `~/.anima/dev-web.token`；Vite 注入为 `remote_auth_token`，首次访问无需粘贴 token。生产栖息地从不把 token 放进 `config.json` —— 用 `anima token create` 与栖息地设置。

流程：打开栖息地设置 → 填写 → **测试连接** → 保存。桌面保存后需**重启桌面壳**。

**Vault 浏览器扩展（浏览器形态入口）：** 选项页填写同一组 URL + Token → 测试连接 → 用用户库主密码解锁。RPC 仅 HTTP REST（background）；见 [`docs/modules/portal.md`](../modules/portal.md)、[`docs/modules/vault.md`](../modules/vault.md)（`just pack browser-extension-chrome` / `browser-extension-firefox`）。

## 3. 认证行为

```text
REST:  Authorization: Bearer <token>
SAP:   WebSocket /sap/v1 → connect frame includes auth_token
MCP:   POST/GET /mcp → Authorization: Bearer <token>
```

`/web/*` 静态资源跳过服务认证；`/api` 与 `/mcp` 需要 Bearer token。

缺少或错误的 token → HTTP `401` 或 SAP 连接关闭。

## 4. MCP 出站（外部 agent 查询栖息地数据）

栖息地在 **`/mcp`** 提供 Streamable HTTP MCP Server，暴露带 `exposeMcp: true` 的工具。当前出站面**仅任务条目**工具（`task_*`：create/update/complete/uncomplete/delete/get/list/search）；任务列表、项目与文件夹仍仅栖息地内。其他 ToolSet 仍可在栖息地聊天室内用，但不在 `/mcp` 列出。外部 MCP 客户端（Cursor、Claude Desktop 等）连接时**无 LLM 中继**。

```yaml
# External agent example (Cursor mcp.json, etc.)
mcpServers:
  freeanima:
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer <remote_auth.token>"
```

- **入站**（栖息地连接外部 MCP 服务器）：runtime `mcp_servers`（`src/host/capabilities/mcp-client`）；在栖息地 UI `/habitat/mcp` 管理
  - 优先 `transport: http`（Streamable HTTP）连本机 `/mcp`；`sse` 仍可用但属旧协议，**不会**自动改写
  - Auth：`headers.Authorization: Bearer env("KEY")`（PG 迁移会把遗留 `api_key_env` 写成此形）；连接时展开 `env()`
- **出站**（外部 agent 调用栖息地工具）：`/mcp` 端点（`src/host/capabilities/mcp-server`）

## 运维

| 命令                             | 说明                                   |
| -------------------------------- | -------------------------------------- |
| `anima token create/list/revoke` | Service API Token 管理（CLI，直连 PG） |
| `anima service status`           | 栖息地栈状态                           |

## 故障排查

| 现象              | 检查                                                              |
| ----------------- | ----------------------------------------------------------------- |
| 连不上栖息地      | 栖息地是否在跑？`anima service status`；检查 `http.host` / 防火墙 |
| 401               | 客户端 token 是否有效；跑 `anima token list --subject-id <id>`    |
| 本机 OK、远程失败 | 远程请求需要 Bearer / SAP auth_token                              |
| 浏览器 CORS 错误  | 使用栖息地 `/web` 同源（或 Vite 代理）；跨源浏览器 UI 不支持      |
| 换 token 后 401   | 更新客户端设置；必要时撤销旧 token                                |

## 相关文档

- 移动：[`mobile-app.md`](../modules/mobile-app.md)
- 桌面伴侣栖息地来源：[`companion.md`](../modules/companion.md)
