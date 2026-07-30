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
- 明文 meta：`title`、`url`、`uris[]`（`uri` + `match`）、`username`、顶层 `tag_ids`（同 World `tag` entity；禁止 `body.tags`）、`import_refs`（如 `bitwarden` UUID）、`custom_field_names`
- 密文：`secrets_enc` + `dek_wrapped`；载荷含 `password` / `totp` / `notes` / `custom_fields` / `card` / `identity`
- `url` 为主展示 URI；`uris` 供 Bitwarden 式匹配（`domain` / `host` / `starts_with` / `exact` / `regex` / `never`）。无 `uris` 时对 `url` 做 domain 匹配

## Shell UI

- 路由：`/vault`
- 解锁 / 改密 / CRUD；用户库导入 **Bitwarden 未加密 JSON**（按 `import_refs.bitwarden` 幂等 upsert；可选「仅新建」）
- 编辑表单与扩展共用 [`features/vault/ui/shared`](../../src/features/vault/ui/shared/)（多 URI、标签、自定义字段等）；数据面仍为 Habitat RPC（与扩展 `sendBg` 不同）

## 浏览器扩展（浏览器形态入口）

- 入口：`src/portal/extension`（WXT MV3；React popup/options + `runtime/` + `features/vault/`；工具栏图标在 `public/icon-*.png`）
- 构建：`just pack browser-extension` → `dist/browser-extension/chrome-mv3`
- 开发：`just dev browser-extension`（或 `bunx wxt`）
- 连接：扩展 **直连 Habitat**（Bearer `fa_at_…`），HTTP REST only；解锁态保存在扩展进程内，并经 `chrome.storage.session` 跨 service worker 回收恢复（**最多 8 小时**；**浏览器关闭后清除**，需重输主密码）
- 能力：按 URL 匹配填充、弹窗列表（`vault.search` 对齐壳检索）、**新建/编辑/删除**（与 Shell 同表单）、保存提示、密码生成、右键菜单、快捷键、卡片/身份填充
- content script：原生 DOM 填充（不挂 React）

加载未打包扩展：Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序 → 选择 `dist/browser-extension/chrome-mv3`。

## 相关

- Portal 四形态：[`docs/modules/portal.md`](portal.md)
- 架构与凭证原则：[`docs/product/architecture.md`](../product/architecture.md)、[`docs/ops/security.md`](../ops/security.md)
- 远程 Token：[`docs/ops/remote-access.md`](../ops/remote-access.md)
- Entity 模型：[`docs/product/entity-model.md`](../product/entity-model.md)
