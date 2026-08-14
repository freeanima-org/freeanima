---
title: 记忆维护（原睡眠机制）
---

# 记忆维护（原睡眠机制）

> **#16102：** 旧浅睡 / 深睡 / 梦境生产路径已拆除。巩固改走 **MemoryService.retain / reflect**；夜间任务为 **memory-maintenance**（cleanup + Retain 缺口检查 + 周一 reflect/self + temporal）。  
> 引用格式：`[[anima:id]]`。SSOT：[`memory.md`](memory.md)。

## 迁移表

| 旧机制                | 新机制                                            | 说明                                   |
| --------------------- | ------------------------------------------------- | -------------------------------------- |
| `light-sleep`         | `MemoryService.retain` + 维护步 `retain-catch-up` | 热路径 `syncTurn` 触发；**补跑仅手动** |
| `deep-sleep`          | `MemoryService.reflect` + 维护步 `reflect`        | 四轮巩固；定时仍 CST 周一              |
| `dream`               | 已废止                                            | 存量 dream 块只读                      |
| `memory-ref-sync`     | **删除**                                          | 热路径已 bump `reference_count`        |
| `builtin-sleep-cycle` | `builtin-memory-maintenance`                      | cron `0 2 * * *`                       |
| pipeline DAG          | **顺序编排**（无 PipelineRunner）                 | 见下                                   |

## Cutover

`memory.cutover.park_limbic_dream_narrative` 默认 true（limbic / dream / narrative 停写）。

## 夜间编排（非 DAG）

见 [`packages/habitat/platform/boot/pipeline-handlers.ts`](../../packages/habitat/platform/boot/pipeline-handlers.ts) 的 `runNightlyMemoryMaintenance`。

顺序：

1. `conversation-cleanup`
2. **Retain 缺口检查**（有缺口 → Inbox 通知；**不自动补跑**）
3. CST 周一：`reflect` → `self-layer-refresh`
4. `temporal-summary-day` → `temporal-summary-cascade`

## 运维 UI 挂载

独立 `/sleep` 页已删除。手动触发散落：

| 能力                             | Habitat 运维页                 |
| -------------------------------- | ------------------------------ |
| 会话清理、完整维护周期           | 数据维护                       |
| Retain 补跑 / Reflect / 一键补跑 | 语义记忆 →「记忆巩固」Dialog   |
| 日/月/年摘要查看与重跑           | 时间摘要（`memory.temporal*`） |
| 自我层刷新                       | 自我层                         |

Habitat RPC：`memoryMaintenance.*`（`summary` / `status` / `runStep` / `startCycle` / `startCatchUp`）。Reflect 模式字段为 `reflect_mode`。LLM 过程在「自动 LLM 运行」中按 `run_kind=memory-retain|memory-reflect|…` 查看。

## 历史说明

旧浅睡 / 深睡设计文档已废止；细节以代码与 [`memory.md`](memory.md) 为准。
