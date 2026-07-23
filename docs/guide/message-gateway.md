---
title: Message gateway
---

# 消息网关配置

Discord / 微信（iLink）通道与全局网关选项保存在 PostgreSQL `habitat_runtime_config`，**不要**写进 `~/.anima/config.yaml`。

## 在哪里改

Shell → **Habitat 服务** → **服务配置**：

| 段                      | 作用                                            |
| ----------------------- | ----------------------------------------------- |
| **网关** (`gateway`)    | 全局 `tool_display`（工具消息展示模式）         |
| **Discord** (`discord`) | Bot token、启用开关、提及/频道策略、home 频道等 |
| **微信** (`weixin`)     | iLink token、`base_url`、账号字段、启用开关     |

敏感字段支持明文、`vault("id","field")` 或 `env("KEY")`。微信亦可仅用环境变量 `WEIXIN_ILINK_TOKEN`。

## 启用与生效

- `enabled: false`：即使有 token 也不启动该通道（默认有 token 且未禁用则启动）。
- 保存后需 **重启 Habitat / anima service** 才会重新 `discoverPlatforms`；当前不支持热重载。

## 测试连接

Discord / 微信段提供「测试连接」：

- Discord：临时 Bot `login`，成功后立即断开。
- 微信：调用 iLink `notifyStart`（与 adapter 启动探测一致）。

表单里 token 显示为 `***` 时，探测会回退到已保存的未脱敏值。

## 安全

Gateway token 放 Vault 或 env；Discord / WeChat **不能**解锁 User vault。见 [`security.md`](security.md)。
