---
title: 睡眠机制（已废止）
---

# 睡眠机制（已废止）

> **#16102：** 浅睡 / 深睡 / 梦境生产路径已拆除。巩固改走 **MemoryService.retain / reflect**；原 sleep-cycle DAG 改为 **memory-maintenance**（cleanup + retain 补跑 + reflect + temporal + self-refresh）。  
> 引用格式：`[[anima:id]]`。SSOT：[`memory.md`](memory.md)。

## 迁移表

| 旧机制                 | 新机制                                            | 说明                                     |
| ---------------------- | ------------------------------------------------- | ---------------------------------------- |
| `light-sleep`          | `MemoryService.retain` + 维护步 `retain-catch-up` | 热路径 `syncTurn` 触发；夜间补跑按日会话 |
| `deep-sleep`           | `MemoryService.reflect` + 维护步 `reflect`        | 四轮巩固；定时仍 CST 周一                |
| `dream`                | 已废止                                            | 存量 dream 块只读                        |
| `memory-ref-sync`      | **删除**                                          | 热路径已 bump `reference_count`          |
| `builtin-sleep-cycle`  | `builtin-memory-maintenance`                      | cron `0 2 * * *`                         |
| pipeline `sleep-cycle` | `memory-maintenance`                              | 运维页路由仍为 `/sleep`                  |

## Cutover

`memory.cutover.disable_sleep_consolidation` **默认 true**（浅/深睡代码已删，标志仅保留回滚语义）。  
`park_limbic_dream_narrative` 默认 true。

## 记忆维护 DAG

见 [`packages/habitat/platform/boot/sleep-cycle.ts`](../../packages/habitat/platform/boot/sleep-cycle.ts)（文件名历史遗留；id 为 `memory-maintenance`）。

步骤：`conversation-cleanup` → `retain-catch-up` →（`reflect` 周一 / `temporal-summary-*`）→ `self-layer-refresh`（周一）。

## 历史说明

旧浅睡 / 深睡设计文档已废止；细节以代码与 [`memory.md`](memory.md) 为准。
