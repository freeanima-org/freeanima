---
title: "ops ToolSet"
---

# ops ToolSet

按需加载的栖息地 ToolSet，用于**栖息地进程运维**：健康、状态、脱敏运行时配置，以及经伙伴确认的配置补丁 / 重启 / standalone 更新。加载方式：

```text
toolset_load(["ops"])
```

## 工具

| 工具               | 用途                                                            |
| ------------------ | --------------------------------------------------------------- |
| `ops_health`       | 进程健康（`status`、`version`、`started_at`）                   |
| `ops_status`       | 完整服务快照（内存、PG/Redis、MCP、对话计数）                   |
| `ops_config_get`   | 密钥掩码为 `***` 的运行时配置；可选 `section`                   |
| `ops_config_patch` | 深合并某运行时配置段；伙伴 clarify 批准后**须 `confirm: true`** |
| `ops_restart`      | 安排栖息地重启；伙伴 clarify 批准后**须 `confirm: true`**       |
| `ops_update_check` | 检查 standalone 栖息地是否有 GitHub Releases 更新               |
| `ops_update_apply` | 下载安装 standalone 更新并安排重启；**须 `confirm: true`**      |

## 确认流（写操作）

1. 调用 ToolSet `clarify` 询问伙伴是否补丁配置、重启或升级。
2. 批准后，以 `confirm: true` 调用 `ops_config_patch` / `ops_restart` / `ops_update_apply`。
3. 无 `confirm: true` 时，写工具返回错误（`ops` 内无等待状态机）。

## 更新

- `ops_update_check` / `ops_update_apply` 仅对 **standalone** 安全前缀有效；源码安装返回 `upgradable: false` 与手动升级提示。
- 可选 `proxy`：`none` | `ghproxy-net` | `gh-proxy-com` | `ghfast-top`（与设置「关于」下载代理一致）。
- UI 等价入口：设置 → 关于 → 服务 →「检查更新」。

## 边界

| 做                                           | 不做                                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| 诊断栖息地时检查状态 / 脱敏配置              | 期望工具结果含密钥（恒为 `***`）                            |
| clarify 后补丁非密钥运行时段                 | 补丁 `database` / `http` / `redis`（引导配置；YAML 冷启动） |
| 某设置需重启时，clarify 后重启               | 经 LLM 工具写入 MCP `env` / `headers` 或密钥键              |
| standalone 经 clarify 后检查/应用更新        | 对源码 tree 做自动 `git pull`                               |
| 凭证用栖息地设置 UI / vault                  | 用 `ops` 做 cron（用 ToolSet `cron`）                       |
| 经 `freeanima_docs`（`ops/` 前缀）读产品文档 | 在栖息地 `/mcp` 对外暴露本 ToolSet                          |

`ops` **不在**默认对话 toolsets 中；需要时再加载。
