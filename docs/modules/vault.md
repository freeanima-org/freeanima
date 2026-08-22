---
title: Vault
---

# Vault（保险库）

用户与 Agent 的加密凭据库。权威存储为 ECS `vault_item` / `vault_config`（User + Agent 两个
private world）。

## 双库

| 库    | 模式              | 解密位置                    | 典型用途                                                                            |
| ----- | ----------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| User  | `master_password` | Portal / 浏览器扩展客户端   | 人类密码、TOTP、卡片；**Agent 根密钥 SSOT**（`import_refs.agent_root_key=habitat`） |
| Agent | `machine`         | Habitat（需本地缓存已解锁） | 工具 `secrets[]`、`vault()` 配置                                                    |

**Agent 根密钥 custody：** 唯一真相源在 **User 库**（主密码保护）。Habitat 侧 `~/.anima/vault/agent-machine.key` 仅为**可重建缓存**（`vault.agentKey.provision` 写入；`lock` 清除）。未解锁（无有效缓存）时 Agent 注密失败（cron / 工具 / `vault()`）。**User 库解锁 / 首次设主密码**时，客户端会自动确保 SSOT 条目存在（有旧缓存则迁入，否则生成）；Habitat 缓存仍须在「数据维护」显式解锁：`provision`。

LLM **从不**看到明文密钥，只见元数据；注入经 `terminal_run` / `code_execute` `secrets[]` 或
`browser_type` `secret`。

## 条目模型（摘要）

- 类型：`login` | `secure_note` | `card` | `identity` | `custom`
- 明文 meta：`title`、`url`、`uris[]`（`uri` + `match`）、`username`、顶层 `tag_ids`（同
  World `tag` entity；禁止 `body.tags`）、`import_refs`（如 `bitwarden`
  UUID、`agent_root_key=habitat`）、`custom_field_names`、`last_used_at`（可选 ISO）
- 密文：`secrets_enc` + `dek_wrapped`；载荷含 `password` / `totp` / `notes` /
  `custom_fields` / `card` / `identity`
- `url` 为主展示 URI；`uris` 供 Bitwarden 式匹配（`domain` / `host` / `starts_with` /
  `exact` / `regex` / `never`）。无 `uris` 时对 `url` 做 domain 匹配
- `last_used_at`：最近一次**自动填充**时间；扩展多匹配同分时按此降序。复制账密不计次。写回走
  `vault.touch`（`skip_revision`）

## 壳 UI

- 路由：`/vault`
- **浏览器安全上下文**：User 库解锁在客户端用 Web Crypto（`crypto.subtle`）。`http://127.0.0.1` /
  `localhost` 可用；局域网明文 HTTP（如 `:2658`）不可用——改用栖息地 HTTPS（默认 `:2659`），见
  [`remote-access.md`](../ops/remote-access.md)
- 解锁 / 改密 / CRUD；用户库导入 **Bitwarden 未加密 JSON**（按 `import_refs.bitwarden` 幂等
  upsert；可选「仅新建」）— 入口在栖息地 **数据维护**（不再放在 `/vault` 工具栏）
- User 库会话：默认 **1 小时滑动超时**（浏览 / 搜索 / 选中条目等 UI 活动会续期）；扩展仍为最多 **8
  小时绝对超时**（浏览器关闭清 session）
- 侧栏：搜索（标题 / 用户名 / URI；`content` 写入时拼入 username+uris）+ 标签单选过滤
- Habitat **数据维护**：**解锁 agent 密码库**（本地缓存状态 + 解锁/锁定；根密钥 SSOT = User 库
  `import_refs.agent_root_key=habitat`，于 User 库解锁时自动确保）
- 编辑表单与扩展共用
  [`features/vault/ui/shared`](../../packages/frontend/features/vault/ui/shared/)（多
  URI、标签、自定义字段等）；数据面仍为 Habitat RPC（与扩展 `sendBg` 不同）
- **Vault 引用选择器**（`VaultRefField`）：设置里 LLM / Discord / 微信 / 对象存储 / Firecrawl
  密钥，以及邮箱账号密码，可从 **Agent 库** 选条目与字段，写入 `vault("item_id", "field")`（仍可手写明文或
  `env("KEY")`）。运行时 `resolveValue` 固定解析 Agent 库。

## 浏览器形态中的 Vault

安装、打包、gecko id、展示名等入口级约定见 [`portal.md`](portal.md)。本节只写 **Vault 在扩展内** 的行为。

- 模块：`packages/frontend/portal/extension/features/vault/`（popup / content / background 协作）
- 连接：扩展 **直连 Habitat**（Bearer `fa_at_…`），HTTP REST only；解锁态保存在扩展进程内，并经
  `chrome.storage.session` 跨 service worker 回收恢复（**最多 8
  小时**；**浏览器关闭后清除**，需重输主密码）。hydrate 须导入**可导出**主密钥，否则本地缓存无法用主密钥加解密并会误报
  `vault_locked`
- 能力：按 URL 匹配填充（同分按 `last_used_at`）、弹窗列表（`vault.search`
  对齐壳检索）、**新建/编辑/删除**（与 Shell 同表单）、保存提示、密码生成、右键菜单、快捷键、卡片/身份填充
- 保存提示：提交登录表单时，若同用户名且 URI 匹配（与自动填充相同的 domain/host/… 语义）已有 login
  且密码未变则**不弹**确认框；密码与库内不同则提示是否更新；离线不弹保存提示
- 本地缓存：`chrome.storage.local` 存放**主密钥 AES-GCM 加密**的条目副本；另存 User 库
  `salt`/`verifier`（非主密钥）以支持冷启动离线解锁；须解锁（主密码）后方可解密条目缓存；锁定仅清内存明文与 session
- 离线：对齐壳 Vault **snapshot
  只读**——曾在线解锁成功后，断网/关浏览器冷启动仍可用主密码解锁本地缓存并填充/浏览；**不可**新建、编辑、删除或登录保存；改密后需再在线解锁一次以刷新本地
  crypto。无本地 crypto 缓存时离线无法解锁
- 填充后：扩展乐观更新本地 `last_used_at`，并调用 `vault.touch` 写回 Habitat；复制用户名/密码/TOTP
  **不**计次
- 弹窗列表：行外常显「自动填充」与「复制密码」
- 页内：聚焦密码框、可识别的用户名框（关键词 / `autocomplete` / `type=email`，或同表单·邻近有 password）、
  或 TOTP/身份验证器框时，Shadow DOM 浮层列出匹配登录项（类 Bitwarden），并提供填充 / 复制密码（TOTP 焦点为「填充验证码」）；
  搜索、图形验证码、短信/手机验证码等非登录框不弹出
- content script：原生 DOM 填充（不挂 React）

## 相关

- Portal 四形态与扩展安装：[`docs/modules/portal.md`](portal.md)
- 架构与凭证原则：[`docs/product/architecture.md`](../product/architecture.md)、[`docs/ops/security.md`](../ops/security.md)
- 远程 Token：[`docs/ops/remote-access.md`](../ops/remote-access.md)
- Entity 模型：[`docs/product/entity-model.md`](../product/entity-model.md)
