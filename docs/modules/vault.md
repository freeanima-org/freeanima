---
title: Vault
---

# Vault（保险库）

用户与 Agent 的加密凭据库。权威存储为 ECS `vault_item` / `vault_config`（User + Agent 两个 private world）。

## 双库

| 库    | 模式                                            | 解密位置                  | 典型用途                         |
| ----- | ----------------------------------------------- | ------------------------- | -------------------------------- |
| User  | `master_password`                               | Portal / 浏览器扩展客户端 | 人类密码、TOTP、卡片             |
| Agent | `machine`（`~/.anima/vault/agent-machine.key`） | Habitat                   | 工具 `secrets[]`、`vault()` 配置 |

LLM **从不**看到明文密钥，只见元数据；注入经 `terminal_run` / `code_execute` `secrets[]` 或 `browser_type` `secret`。

## 条目模型（摘要）

- 类型：`login` | `secure_note` | `card` | `identity` | `custom`
- 明文 meta：`title`、`url`、`uris[]`（`uri` + `match`）、`username`、`tags`、`import_refs`（如 `bitwarden` UUID）、`custom_field_names`
- 密文：`secrets_enc` + `dek_wrapped`；载荷含 `password` / `totp` / `notes` / `custom_fields` / `card` / `identity`
- `url` 为主展示 URI；`uris` 供 Bitwarden 式匹配（`domain` / `host` / `starts_with` / `exact` / `regex` / `never`）。无 `uris` 时对 `url` 做 domain 匹配

## Shell UI

- 路由：`/vault`
- 解锁 / 改密 / CRUD；用户库导入 **Bitwarden 未加密 JSON**（按 `import_refs.bitwarden` 幂等 upsert；可选「仅新建」）

## 浏览器扩展（浏览器形态入口）

- 入口：`src/portal/extension`（WXT MV3；`runtime/` + `features/vault/`）
- 构建：`just pack browser-extension` → `dist/browser-extension/chrome-mv3`
- 开发：`just dev browser-extension`（或 `bunx wxt`）
- 连接：扩展 **直连 Habitat**（Bearer `fa_at_…`），HTTP REST only；主密码仅扩展内存会话（默认 15 分钟）
- 能力：按 URL 匹配填充、弹窗、保存提示、密码生成、右键菜单、快捷键、卡片/身份填充

加载未打包扩展：Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序 → 选择 `dist/browser-extension/chrome-mv3`。

## 相关

- Portal 四形态：[`docs/modules/portal.md`](portal.md)
- 架构与凭证原则：[`docs/product/architecture.md`](../product/architecture.md)、[`docs/ops/security.md`](../ops/security.md)
- 远程 Token：[`docs/ops/remote-access.md`](../ops/remote-access.md)
- Entity 模型：[`docs/product/entity-model.md`](../product/entity-model.md)
