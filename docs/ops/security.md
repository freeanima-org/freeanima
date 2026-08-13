---
title: 安全
---

# 逸灵风安全

> 采纳原则：[architecture.md](../product/architecture.md)。
> 安全评审与实现项：[GitHub Issue #33](https://github.com/freeanima-org/freeanima/issues/33)、[#46](https://github.com/freeanima-org/freeanima/issues/46)。

## 信任模型（开源部署必读）

逸灵风设计为**单人本地 / 内网**部署：

- 栖息地 RPC REST（`/rpc/v1/*`，health 探测 / CORS / echo 除外）需要 **Service API Token**（`Authorization: Bearer fa_at_…`）；用 `anima token create` 创建。绑定 `127.0.0.1` 可限制网络暴露，但**不能**替代 token 鉴权——任何能到达端口的本机进程，业务路由仍需有效 token。
- 默认 bind 为 `127.0.0.1`；若需局域网访问，请自行评估 CORS 与网络隔离。
- **禁止**在无 TLS、无 token 保护客户端的情况下把服务暴露到公网（见 [`remote-access.md`](remote-access.md)）。可选 `http.tls.mode: acme`（Let's Encrypt HTTP-01，公网 `:80` challenge + `:2659` HTTPS）仍须 Token；不替代防火墙 / 反向代理加固。

## 凭证职责

| 规则                   | 说明                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 唯一权威存储           | **Vault**（User + Agent 库中的 ECS `vault_item`）；遗留 pass（`~/.password-store`）迁移后磁盘只读——运行时不再使用 pass CLI                                                                                                                                                                        |
| 带版本更新             | 实质性 vault 条目更新最多保留 10 份历史快照（`entities.revisions`）；经壳 `/vault` 历史恢复。见 [`entity-revisions`](../aspects/entity-revisions.md)                                                                                                                                              |
| 永不提交密钥           | 勿把 API 密钥、token、数据库密码写入 git。引导 `config.yaml`：用 `env()`（或把密钥放在文件外）。运行时 LLM/MCP 设置在 PG——在那里用 `vault()` / `env()`                                                                                                                                            |
| 运行时目录             | `~/.anima/`（可用 `FREEANIMA_HOME` 覆盖）存放配置、可选 Agent vault **缓存**（`vault/agent-machine.key`）、对话、记忆——建议 `chmod 700`。Agent 根密钥 SSOT 在 User vault（PG），不是家目录持久密钥。                                                                                              |
| 用户主密码             | 仅在壳 `/vault`、内嵌聊天室解锁，或浏览器形态入口内 Vault 解锁；**永不**作为聊天消息发送或存入 PG messages                                                                                                                                                                                        |
| 聊天室 User vault 解锁 | **仅 v1 内嵌聊天室**（`src/portal/app/web` / desktop / mobile）；Discord / 微信 Gateway **不能**解锁 User 库                                                                                                                                                                                      |
| 浏览器扩展             | 浏览器形态入口（`src/portal/extension`；展示名 FreeAnima；Firefox gecko `extension@freeanima.com`）；Service API Token 存 `chrome.storage.local`；主密码仅扩展内存（默认 15min）；RPC 走 background `host_permissions`。见 [`portal.md`](../modules/portal.md)、[`vault.md`](../modules/vault.md) |

`config.yaml` **仅作引导**（PostgreSQL 起来之前读取）。其中的密钥支持明文或 `env("KEY")`——**不是** `vault()`（Vault 条目在 PG）。栖息地连通后，PG 中的运行时配置可用 `vault("item_id", "field")` 与 `env("KEY")`。需要 CLI 凭证的 Agent 工具在 `terminal_run` / `code_execute` 上按次传入 `secrets[]`（仅子进程 env）。浏览器表单字段用 `browser_type` 的 `secret`（键入页面；永不在工具结果中回显）。User 库解析仍要求客户端有已解锁的聊天室会话。

### Vault 信任边界

| 面        | User 库                                                | Agent 库                                                           |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| 栖息地 PG | 密文 + verifier；可持有 Agent 根密钥 SSOT 条目         | 仅密文；根密钥不以 PG 明文存储                                     |
| 磁盘      | —                                                      | 解锁后可重建的缓存 `vault/agent-machine.key`（`provision` / lock） |
| LLM       | 仅元数据；子进程 `secrets[]` / `browser_type` `secret` | 仅元数据；子进程 `secrets[]` / `browser_type` `secret`             |
| 壳        | 客户端主密钥在内存                                     | 仅缓存解锁时由栖息地解密                                           |

## 数据持久化

| 路径                               | 内容                            | 加密                                                      |
| ---------------------------------- | ------------------------------- | --------------------------------------------------------- |
| PostgreSQL                         | 对话 / 记忆 / Vault 密文        | 无应用层加密；User vault 在主密码下持有 Agent 根密钥 SSOT |
| `~/.anima/vault/agent-machine.key` | Agent vault **缓存**（非 SSOT） | 文件权限（`chmod 600`）；经数据维护解锁重建               |
| `~/.anima/weixin/`                 | 微信同步状态                    | 无                                                        |

**实例备份集：** PostgreSQL（必需）+ `FREEANIMA_HOME`（引导/`config.yaml`/TLS/weixin，按需）。Agent 根密钥在主密码解锁后从 User vault 恢复——缓存文件可选。**已解锁**缓存的磁盘备份 = 数据可达；请保护备份介质。无栖息地缓存解锁时，Agent 注入（cron / 工具 / `vault()`）失败。

## LLM 工具风险

| 能力                                                       | 风险                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terminal_run`                                             | 默认 `shell: false`（argv spawn）。显式 `shell: true` 启用管道/重定向。可选 `secrets[]` 把 Vault 解密到**仅该子进程 env**（非栖息地 `process.env`）。对灾难性目标常开硬拒绝——**不是** OS 沙箱；仍可能经 `code_execute` / 解释器绕过                                                      |
| `file_read` / `file_write` / `file_delete` / `file_search` | 路径拒绝：`/etc`、`/proc`、`/sys`、危险 `/dev`、`~/.ssh` 私钥、`FREEANIMA_HOME/vault`。启发式拒绝 ≠ 可写根沙箱                                                                                                                                                                           |
| `code_execute`                                             | 无 shell（Bun/Node argv）。可选 `secrets[]` 同 `terminal_run`。任意 JS 仍可用 `node:fs`——不是容器沙箱                                                                                                                                                                                    |
| `browser_type`                                             | 可选 `secret` 解密一个 Vault 字段并键入页面；工具结果把 `typed` 打码为 `***`（永不明文）                                                                                                                                                                                                 |
| MCP 工具                                                   | 能力完全由外部 Server 决定；默认 stdio，SSE 鉴权方案未完全定义                                                                                                                                                                                                                           |
| 能力策略                                                   | 硬工具约束：技能 `allowed_tools` + 调用方（cron/睡眠/subagent）可选 allow/deny；`deny` 覆盖 `allow`；不是 Mask 预设衣橱。数据 allow/deny 预留。见 [`skills.md`](../modules/skills.md)、[`architecture.md`](../product/architecture.md) 能力策略、[`subagent.md`](../modules/subagent.md) |
| `vault_list` / `vault_search` / `vault_get_meta`           | 仅 Vault 元数据；无密钥值。仅栖息地（非 MCP）                                                                                                                                                                                                                                            |
| `vault_create` / `vault_update` / `vault_delete`           | 仅栖息地（非 MCP）。create/update 仅向 **Agent** 库密封明文；工具结果仅元数据。User 库写入留在 Vault UI                                                                                                                                                                                  |

### Agent vault 用法

需要栖息地 Agent 缓存**已解锁**（数据维护 → 解锁 Agent vault；从 User vault SSOT 播种）。否则解密/密封抛 `AGENT_VAULT_LOCKED`。

1. **发现** — `vault_list` / `vault_search` / `vault_get_meta`（仅元数据；工具结果永不含明文）。
2. **写入（Agent 库）** — 仅在栖息地聊天中用 `vault_create` / `vault_update` / `vault_delete`。create/update 接受明文 `secrets` 在栖息地密封；结果仅返回元数据。User 库：Vault UI。（整个 vault ToolSet 不经 MCP 暴露。）
3. **使用** — 在需要凭证的同一次 `terminal_run` 或 `code_execute` 调用上传入 `secrets: [{ id, env_name, field?, subject_kind? }]`（如 `GH_TOKEN` 给 `gh`）；或在 `browser_type` 上用 `secret: { id, field }` 填表单。对 `field: "totp"`，解析值为**当前 TOTP 码**（RFC 6238），不是存储的 Base32 密钥。
4. **作用域** — 明文仅为本调用解密（`secrets[]` → 子进程 `env`；`browser_type` `secret` → Camofox 键入载荷）。**不**写入栖息地 `process.env`，**不**出现在工具结果。默认 `shell=false`：用 argv 形式（`printenv GH_TOKEN`、`gh …`），不要 `echo $VAR`。

## 已有措施

| 措施                | 说明                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 同源 RPC            | TanStack Start server functions 默认同源，无需 CORS 白名单                                                                       |
| 配置 API 密钥       | 栖息地 config GET 以明文返回密钥（`api_key`、MCP `env` / `headers` 等）。写回时遗留 `"***"` 经 `restoreMaskedSecrets` 恢复       |
| MCP 配置            | `sanitizeConfigForApi` 保留 MCP `env` / `headers` 明文，便于栖息地 MCP 页来回编辑                                                |
| 文件路径策略        | `file_*` 工具共用 `path-policy`：`/etc`、vault、ssh 私钥、`/proc`/`/sys`、阻断设备                                               |
| 终端 shell 默认关闭 | `terminal_run` 默认 `shell=false`；仅在需要管道/重定向时传 `shell=true`（摩擦，非沙箱）                                          |
| 终端命令硬拒绝      | 常开灾难性命令策略（`terminal-command-policy`）；不能用 env 关闭                                                                 |
| Slash 命令          | 白名单路由；每条命令须产生用户可见反馈；长命令先立即 ack 再给最终结果                                                            |
| MCP 默认 stdio      | 降低端口暴露                                                                                                                     |
| Vault 隔离          | LLM 只见 vault 条目元数据，不见解密字段                                                                                          |
| Service API Token   | 栖息地 RPC REST `/rpc/v1/*` 路由需要 `Authorization: Bearer fa_at_…`（`service_api_tokens` PG 表）；health 探测/CORS/echo 豁免。 |
| CI 密钥扫描         | `.github/workflows/security.yml`（Gitleaks）；GitHub Secret scanning + Push protection（公开仓库免费）                           |
| `.gitignore`        | `.env.*`、`config.yaml`、私钥后缀                                                                                                |

## 已知缺口（文档 ≠ 已完全实现）

以下在代码或文档中规划，**部署者请勿假设已实现**：

| 优先级 | 项                                             | 状态                                     |
| ------ | ---------------------------------------------- | ---------------------------------------- |
| P0     | `file_*` 路径拒绝（`/etc/`、vault、ssh、…）    | **已实现**（`path-policy`）              |
| P0     | `terminal_run` 默认 `shell=false`              | **已实现**                               |
| P0     | 终端灾难性命令硬拒绝                           | **已实现**（启发式；≠ 沙箱）             |
| P0     | `code_execute` 无 shell                        | **已实现**（JS FS 仍开放）               |
| P1     | 运行时 Unix socket `chmod 600` + 握手 token    | 未实现                                   |
| P1     | `FREEANIMA_WRITE_SAFE_ROOT` / `READ_SAFE_ROOT` | 未实现                                   |
| P2     | （退役）配置 API 字段脱敏维护                  | 已放弃——密钥不脱敏（含 MCP env/headers） |
| P3     | IPC / LLM 限流                                 | 无                                       |
| P3     | 会话磁盘加密                                   | 无                                       |

## 威胁来源

| 代号  | 名称         | 说明                             |
| ----- | ------------ | -------------------------------- |
| **A** | 外部攻击     | 未授权访问、端口暴露             |
| **B** | LLM 层注入   | 提示注入、工具参数操纵、命令注入 |
| **C** | Agent 误操作 | 误发危险操作                     |
| **D** | 依赖链       | 第三方库 / MCP 被攻陷            |
| **E** | 数据安全     | 对话泄漏、密钥泄漏、记忆篡改     |

## 安全矩阵

| 模块              | A 外部                                                     | B LLM 注入                                               | C Agent 误操作      | D 依赖         | E 数据                       |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ------------------- | -------------- | ---------------------------- |
| **运行时**        | 默认 127.0.0.1 bind                                        | MaxTurnsExceeded                                         | 缺口：限流          | llm 客户端漏洞 | PG 未加密                    |
| **Gateway**       | Token 在 Vault / env                                       | 恶意消息                                                 | 回复含敏感信息      | SDK 漏洞       | —                            |
| **CLI / 工具**    | 本机 shell 被控                                            | 路径拒绝 + 终端硬拒绝（可经 `code_execute` 绕过）        | 降低灾难性 rm       | —              | 日志可能含对话               |
| **HTTP / 栖息地** | `service_api_tokens` Bearer token（所有来源，含 loopback） | BFF 不直接碰 LLM 参数                                    | 配置展示            | Vue/axios      | SSE 明文                     |
| **MCP**           | SSE 鉴权未定义                                             | 恶意参数                                                 | 错误工具调用        | Server 被攻陷  | 上下文可能含敏感数据         |
| **Vault**         | Agent machine key 文件权限                                 | 仅元数据工具；按次 `secrets[]` / `browser_type` `secret` | 错误条目 / env_name | Web Crypto     | 用户主密码永不进 PG messages |

## 待评审提案

### P0 — 文件路径安全（已落地）

- 读/写/删/搜拒绝：`/etc/`、`/proc/`、`~/.ssh/` 私钥、`FREEANIMA_HOME` 下 vault
- 可选 `FREEANIMA_READ_SAFE_ROOT` 仍为 **P1**

### P0 — Shell 执行 + 命令硬拒绝（已落地）

- `terminal_run` 默认 `shell=false`；仅在需要管道/重定向时传 `shell=true`（非沙箱）
- 常开拒绝：灾难性 `rm`/`rmdir`、`mkfs*`、`dd of=/dev/…`、fork bomb、电源命令、对 `/` 或 `$HOME` 的递归 chmod/chown、对系统/家目录根的破坏性 `find`
- `code_execute` 仍为仅 argv（无 shell）；**不是**进程沙箱

### P1 — 运行时 / Gateway

- Unix socket `chmod 600` + 可选握手 token
- 写安全根默认 cwd（`FREEANIMA_WRITE_SAFE_ROOT`）

### P2 — 配置脱敏维护

- 新增密钥字段时，同步平台中的配置消毒逻辑

## 首次部署安全清单

1. 复制 [`config.example.yaml`](../../config.example.yaml) → `~/.anima/config.yaml`；引导密钥用 `env()`——**不要**在配置里写明文密钥；`vault()` 供栖息地起来后的 PG 运行时配置
2. 打开壳 `/vault`；设置 User 主密码；按需从遗留 pass 迁移密钥
3. `chmod 700 ~/.anima`（含可选 `vault/agent-machine.key` 缓存）
4. 仅 bind `127.0.0.1`，或确保内网隔离
5. 在栖息地 UI（`/habitat/mcp`）审查入站 MCP；对不信任的外部 Server 设 `enabled: false`
6. 定期备份 `~/.anima/`（若保留则含遗留 `~/.password-store`）；备份介质加密存储
7. 勿将 `.env`、`config.yaml` 提交到 git
8. 除非确需管道/重定向，否则不要在 `terminal_run` 上传 `shell=true`
