# 逸灵风安全

> 已采纳原则见 [ARCHITECTURE.md](../ARCHITECTURE.md)。
> 当前任务中的安全评审见 [TODOS.md](../TODOS.md)。

## 信任模型（开源部署必读）

逸灵风设计为**单人本地 / 内网**部署：

- HTTP / WebUI **默认无鉴权**；绑定 `127.0.0.1` 不等于安全——任何能访问端口的进程或用户均可读会话、发消息、启停 MCP/ACP。
- 默认 bind 为 `127.0.0.1`；若需局域网访问，请自行评估 CORS 与网络隔离。
- **不要**将服务暴露到公网而不加反向代理鉴权。

## 凭证责任

| 规则          | 说明                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 唯一权威存储  | [pass](https://www.passwordstore.org/)（GPG，`~/.password-store`）                                                                   |
| 禁止入库      | 勿将 API Key、Token、DB 密码写入 `config.yaml` 并提交 git                                                                            |
| 运行时目录    | `~/.anima/`（`FREEANIMA_HOME` 可改）含 config、会话、记忆——建议 `chmod 700`                                                          |
| CLI 明文输出  | `anima credential get` 向 stdout 打印明文；勿重定向到共享日志                                                                        |
| pass 路径约定 | `api/opencode-go`、`services/discord`、`services/firecrawl`、`services/postgres/anima`、`services/pushdeer`、`services/weixin-ilink` |

`config.yaml` 支持 `database.url: pass:services/postgres/anima` 等形式；密钥由运行时从 pass 注入。

## 数据持久化

| 路径                               | 内容                | 加密                 |
| ---------------------------------- | ------------------- | -------------------- |
| PostgreSQL L1                      | sessions / messages | 无应用层加密         |
| `~/.anima/memory/`                 | L2/L3 记忆文件      | 无                   |
| `~/.anima/weixin/`                 | 微信同步状态        | 无                   |
| `~/.hermes/weixin/accounts/*.json` | Hermes 遗留明文回退 | 无（代码仍支持读取） |

磁盘备份 = 数据访问。请妥善保护备份介质。

## LLM 工具风险

| 能力               | 风险                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `terminal`         | 默认 `shell: true`，可执行任意 shell 命令                               |
| `read_file`        | 部分路径 deny（`.ssh` 私钥、`/etc/passwd` 等）；**未**全面 deny `/etc/` |
| `write_file`       | deny list + 写保护路径                                                  |
| MCP 工具           | 能力完全由外部 Server 决定；stdio 默认，SSE 认证方案未完整定义          |
| ACP（Cursor）      | 默认 **自动批准** 所有 `session/request_permission`（`allow-once`）     |
| `list_credentials` | 仅返回 pass 路径元数据，不含值                                          |

## 已覆盖措施

| 措施           | 说明                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| 同域 RPC       | TanStack Start server functions 默认同源，无需 CORS 白名单                                                      |
| 配置密钥脱敏   | `NestService.getConfig()` → `sanitizeConfigForApi()`（`api_key`、`database.url`、嵌套 `pushkey`、`mcp env` 等） |
| MCP 配置脱敏   | `sanitizeMcpConfig`：`env` 仅暴露 `env_keys`                                                                    |
| 写路径安全     | `write_file` deny list（部分 `/etc/*`、`.ssh` 私钥等）                                                          |
| Slash 命令     | 白名单路由                                                                                                      |
| MCP 默认 stdio | 减少端口暴露                                                                                                    |
| 凭证隔离       | LLM 只见 pass 路径，不见值                                                                                      |
| CI 密钥扫描    | `.github/workflows/ts.yml` 含 gitleaks                                                                          |
| `.gitignore`   | `.env.*`、`config.yaml`、私钥后缀                                                                               |

## 已知缺口（文档 ≠ 已全部落地）

以下在代码或文档中规划，**部署者请勿假设已实现**：

| 优先级 | 项                                             | 现状     |
| ------ | ---------------------------------------------- | -------- |
| P0     | read_file 全面 deny（`/etc/` 等）              | 部分实现 |
| P0     | `terminal` / `execute_code` 默认 `shell=False` | 未实现   |
| P1     | Runtime Unix socket `chmod 600` + 握手 token   | 未实现   |
| P1     | `FREEANIMA_WRITE_SAFE_ROOT` / `READ_SAFE_ROOT` | 未实现   |
| P2     | HTTP API 鉴权                                  | 无       |
| P3     | IPC / LLM 速率限制                             | 无       |
| P3     | Session 磁盘加密                               | 无       |

## 威胁源

| 代号  | 名称       | 说明                                |
| ----- | ---------- | ----------------------------------- |
| **A** | 外网攻击   | 未授权访问、端口暴露                |
| **B** | LLM 层注入 | Prompt 注入、工具参数操纵、命令注入 |
| **C** | Agent 过失 | 误执行危险操作                      |
| **D** | 依赖链     | 三方库 / MCP / ACP 被攻陷           |
| **E** | 数据安全   | 对话泄露、密钥泄露、记忆篡改        |

## 安全矩阵

| 模块             | A 外网              | B LLM 注入                                                 | C Agent 过失     | D 依赖链        | E 数据           |
| ---------------- | ------------------- | ---------------------------------------------------------- | ---------------- | --------------- | ---------------- |
| **Runtime**      | 默认 127.0.0.1 bind | MaxTurnsExceeded                                           | 缺口：速率限制   | llm client 漏洞 | PG 无加密        |
| **Gateway**      | Token 在 pass       | 恶意消息                                                   | 错误回复敏感信息 | SDK 漏洞        | —                |
| **CLI / Tools**  | 本地 shell 被攻陷   | read_file 部分 deny（**P0 扩展中**）；shell=True（**P0**） | rm -rf 等        | —               | 日志可能含对话   |
| **HTTP / WebUI** | 无鉴权；CORS 白名单 | BFF 不直连 LLM 参数                                        | config 展示      | Vue/axios       | SSE 明文         |
| **MCP / ACP**    | SSE 认证未定义      | 恶意参数                                                   | 错误委托         | Server 被攻陷   | 上下文含敏感数据 |

## 待评审方案

### P0 — read_file 路径安全

- 读侧 deny：`/etc/`、`/proc/`、`~/.ssh/` 等
- 可选 `FREEANIMA_READ_SAFE_ROOT`

### P0 — shell 执行策略

- `terminal()` / `execute_code` 默认 `shell=False`
- `FREEANIMA_ALLOW_SHELL=true` 才允许 shell 管道

### P1 — Runtime / Gateway

- Unix socket `chmod 600` + 可选握手 token
- 写安全根默认 cwd（`FREEANIMA_WRITE_SAFE_ROOT`）

### P2 — 配置脱敏维护

- 新增密钥字段时同步更新 [`service/config/src/config-sanitize.ts`](../service/config/src/config-sanitize.ts)

## 首次部署安全清单

1. 安装并初始化 pass + GPG；所有密钥只进 pass
2. 复制 [`config.example.yaml`](../config.example.yaml) → `~/.anima/config.yaml`；**勿**在 config 中写明文密钥
3. `chmod 700 ~/.anima`
4. 仅 bind `127.0.0.1`，或确保内网隔离
5. 审查 `mcp_servers` / `acp_agents` 配置；不信任的外部 Server 设 `enabled: false`
6. 定期备份 pass 与 `~/.anima/`；备份介质加密存储
7. 勿将 `.env`、`config.yaml` 提交到 git
