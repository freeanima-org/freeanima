---
title: Remote access
---

# Remote access（Tunnel + 应用 Token）

> 通过 **Cloudflare Tunnel** 将家里 PC 上的 Hub 暴露到公网时，由 Hub **`remote_auth`** Bearer Token 保护非本地连接。
> 安全上下文：[`security.md`](security.md) · 安装：[`install.md`](install.md)

## 概览

| 层                    | 作用                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Hub `remote_auth`** | `config.yaml` 明文 token；REST `Authorization: Bearer`；SAP `connect` 帧 `auth_token`；MCP `/mcp` 同样 Bearer |
| **cloudflared**       | 出站隧道；Hub hostname → `127.0.0.1:2658`，Web hostname → `127.0.0.1:2659`（可选）                            |
| **客户端设置**        | app/desktop / app/mobile / **浏览器 Web** 在 **Hub 设置页**填写 Hub 地址与 token                              |

仅当 **Host 为 loopback**（`127.0.0.1` / `localhost` / `::1`）**且 TCP 对端也为 loopback** 时 **不验 token**（本地开发、CLI/systemd 探活）。公网域名（经 Tunnel）、局域网 IP 等访问时须带 token；与 `tunnel.enabled` 无关。

## 1. Hub 配置

在 `~/.anima/config.yaml` 中设置（**仅本地使用可省略**；暴露到局域网或公网前必须配置）：

```yaml
remote_auth:
  token: "请替换为 openssl rand -base64 32 生成的随机串"
```

生成示例：

```bash
openssl rand -base64 32
```

`.gitignore` 已忽略 `config.yaml`；请勿提交到 git。Admin API 读配置时会对 `remote_auth.token` 脱敏显示。

## 2. Tunnel（可选）

```bash
anima tunnel setup
anima service start
```

`tunnel.enabled: true` 时随 **`anima service start`** stack 启动 cloudflared（不再使用独立 `anima-tunnel.service`）。Ingress 默认指向本机 Hub `:2658`；若配置 `tunnel.web_hostname` 与 `web.enabled`，第二条 ingress 指向 Web `:2659`。

```yaml
tunnel:
  enabled: true
  hostname: anima.example.com
  web_hostname: app.anima.example.com

web:
  enabled: true
  port: 2659
  public_url: https://app.anima.example.com
```

若不使用 Tunnel，局域网可分别访问 `http://<PC-IP>:2658`（Hub）与 `:2659`（Web）；客户端在设置页填写 Hub 地址与 token。

### Cloudflare 凭证（pass）

| pass 路径                                | 用途                     |
| ---------------------------------------- | ------------------------ |
| `services/cloudflare/api-token`          | 创建 Tunnel / DNS        |
| `services/cloudflare/tunnel-credentials` | `cloudflared` 连接器凭证 |

详见向导 `anima tunnel setup`。

## 3. 客户端配置

**app/desktop**、**app/mobile** 与 **浏览器 Web**（`web.enabled` + Tunnel 或局域网 `:2659`）均视为远端客户端，**不读取** Hub 的 `config.yaml` token。

| 客户端      | 存储位置                                     |
| ----------- | -------------------------------------------- |
| app/desktop | `~/.anima-desktop/settings.json`（`hub` 段） |
| app/mobile  | Capacitor Preferences                        |
| 浏览器 Web  | localStorage（设置页）                       |

桌面调试与 Sentry 配置在同一文件的 `debug` 段；可用环境变量 `FREEANIMA_DESKTOP_HOME` 覆盖目录（默认 `~/.anima-desktop`）。若存在旧版 `~/.anima/shell-client.json`，首次启动会自动迁移。

设置项（两端一致）：

1. **Hub 地址** — 如 `https://anima.example.com`（Web UI 与 Hub 分域名时填 **Hub** hostname，非 Web UI 域名）
2. **远程 Token** — 与 Hub `remote_auth.token` 相同

浏览器 Web：`/config.json` 可提示默认 Hub（来自 `tunnel.hostname`）；首次访问仍须在设置页保存 token。

操作：打开 Hub 设置 → 填写 → **测试连接** → 保存。桌面端保存后需 **重启 app/desktop**。

## 4. 认证行为

```text
REST:  Authorization: Bearer <token>
SAP:   WebSocket /sap/v1 → connect 帧含 auth_token 字段
MCP:   POST/GET /mcp → Authorization: Bearer <token>
```

## 5. MCP 出站（外部 Agent 查询 Hub 数据）

Hub 在 **`/mcp`** 提供 Streamable HTTP MCP Server，暴露 ToolSet 中 `expose_mcp: true` 的只读查询工具（如 `memory_recall`、`conversation_search`）。外部 MCP Client（Cursor、Claude Desktop 等）可连接并调用，**不经 LLM 中转**。

```yaml
# 外部 agent 配置示例（Cursor mcp.json 等）
mcpServers:
  freeanima:
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer <remote_auth.token>"
```

- **入站**（Hub 连接外部 MCP Server 并注册工具）：仍用 `config.yaml` 的 `mcp_servers`（`capabilities/mcp-client`）
- **出站**（外部 agent 调用 Hub 工具）：`/mcp` 端点（`capabilities/mcp-server`）
- 公网 / 局域网访问须与 REST 相同携带 `remote_auth` token；loopback 直连可省略

缺少或错误 token → HTTP `401` 或 SAP 连接关闭。

判定依据为请求 URL 的 **Host**（经 Tunnel 时为公网域名，如 `anima.example.com`）与 **TCP 对端地址**；Hub 不读取 `tunnel.enabled` 决定是否验 token。

## 运维命令

| 命令                           | 说明                                              |
| ------------------------------ | ------------------------------------------------- |
| `anima tunnel status`          | Tunnel / cloudflared 状态                         |
| `anima tunnel start` / `stop`  | 手动启停 cloudflared（生产由 service stack 托管） |
| `anima web start --foreground` | 独立 Web 静态服（调试）                           |
| `anima service status`         | Hub / Web / Tunnel stack                          |

## 故障排查

| 现象                   | 检查                                                       |
| ---------------------- | ---------------------------------------------------------- |
| 公网 502               | Hub 是否运行？`anima service status`                       |
| 公网 1033              | `anima tunnel status` 中 `connected: no`                   |
| 401                    | 客户端 token 是否与 `remote_auth.token` 一致               |
| 本机开发正常、远程失败 | 远程请求是否带 Bearer / SAP auth_token；公网 Host 须 token |
| 改 token 后仍 401      | 更新 Hub config **并** 各客户端设置页                      |

## 相关文档

- 移动端：[`mobile-app.md`](../features/mobile-app.md)
- 桌面伴侣 Hub 来源：[`companion.md`](../features/companion.md)
