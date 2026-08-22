---
title: 环境感知
---

# 环境感知

> 栖息地进程循环：采集环境 + 健康标记 → 与基线比较 → 有变化则通知，否则保持安静。
> 相关：[Issue #44](https://github.com/freeanima-org/freeanima/issues/44)（面向伙伴的健康警告）、[`self-layer.md`](self-layer.md)、[`notifications.md`](notifications.md)。

## 两条通道

| 通道                   | 节奏                              | 角色                                                       |
| ---------------------- | --------------------------------- | ---------------------------------------------------------- |
| **系统提示**（会话）   | 对话初始化 / CST 02:00 重建时快照 | 静态**环境 + 健康基线**（+ 用户活跃统计）                  |
| **收件箱通知**（事件） | 标记相对基线变化时                | 即时面向 **user + agent**；agent 经 `notification_context` |

会话提示**不**在每次变化时重写 — 实时感知在事件层。下一个日界（或新会话）再拾取更新后的基线。

## 循环（`builtin-env-health`）

调度：每 5 分钟（`*/5 * * * *`），栖息地**进程内 `Bun.cron`**（非 PG `cron_jobs` / `cron_log`）。

```text
collect markers (banded)
  → load baseline (Redis KV `anima:kv:env-health-baseline`, else file fallback)
  → no baseline? save & quiet (init)
  → unchanged? quiet
  → changed? notify user+agent (source_ref dedupe) → save baseline
  → postgres error in changed keys? skip inbox, save baseline only (PG unavailable)
```

实现：`packages/habitat/platform/service/env-health/`。

**存储：** 基线为 **KV**（无 TTL），经 `@freeanima/habitat/core/redis` — 已配置则用 Redis；否则 `~/.anima/env-health-baseline.json`。旧文件存在且首次命中 Redis 时迁移一次并删文件。勿与用户活跃统计用的 **Cache**（`anima:cache:*`，有 TTL）混淆。

## v1 标记（分档后）

**环境：** hostname、OS、时区标签、栖息地版本、boot started_at、PostgreSQL / Redis 状态（`connected` | `error` | `not_configured`）。

**健康：** RSS 分档（512 MiB）、MCP 连接数、`FREEANIMA_HOME` 磁盘空闲分档（`<1GiB` | `1-2GiB` | `2-4GiB` | `4-8GiB` | `≥8GiB` | `unknown`）。

连续指标分档，避免微小抖动刷屏通知。

## 系统提示段

| Hook id               | 顺序 | 内容                                                     |
| --------------------- | ---- | -------------------------------------------------------- |
| `env-health-baseline` | 15   | 环境 + 健康基线                                          |
| `user-activity-stats` | 16   | **用户活跃统计**面板（CST 窗口；日缓存；**无**变化通知） |

注册于 `register-prompt-hooks.ts`。

### 用户活跃统计面板

仅用户侧对话密度（新开 / 更新会话、用户消息 — 不含 agent/工具流量）。CST 日历窗口：今天 / 昨天 / 前天 / 近 7·30·90 天 / 近 1 年。排除 `debug` 与 `cron`。随系统提示日界刷新；同一 CST 日复用 Cache（`anima:cache:user-activity-stats`）。实现：`packages/habitat/platform/service/user-activity-stats/`。

## 通知

- 接收方：**user 与 agent**
- `source_kind: system`
- `source_ref: env-health:<sortedChangedKeys>:<fingerprint>`
- 若双方已有该 `source_ref`，跳过创建（去重）但仍刷新基线
- **PostgreSQL 标记为 `error`**（含本次变更键含 `postgres`）：跳过 Inbox 写库，仅刷新基线；恢复为 `connected` 后再发变更通知（避免 PG 不可用时查 `notifications` 二次失败）
- **开发栖息地**（`FREEANIMA_DEV_HABITAT=1` / `just dev habitat`）：通知时忽略 `boot_started_at`（仍刷新基线）。其他标记变化仍通知；生产 / 独立版重启仍对 boot 通知。

用户活跃面板**不**发出变化通知。

## 非本模块

- 栖息地健康仪表盘 UI（Issue #21 epic 项）
- 场景感知（对话氛围）
- 栖息地 HTTP `health.probe` / MCP 进程健康检查（运维，非认知基线）
- 近记忆 / 跨会话摘要注入
