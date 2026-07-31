# 任务模块

任务（`task_item`）与清单 / 智能清单 / 项目内任务共享同一实体组件；**重复任务**为滴答式 **A′**（live 系列头 + 完成历史），无独立模板实体。

## 数据模型

### Live `task_item`

- 永远代表「当前期」：待办列表只查 live。
- `body.recurrence`（可选）：`freq` / `interval` / `anchor`（`due` | `completion`）/ `weekdays?` / `until?` / `count?` / **`schedule_at`**。
- **显示与提醒**用顶层 `due_at` / `remind_at`；**规则时钟**用 `recurrence.schedule_at`。
- 「仅此一次」改期：只改 `due_at`（及 remind 相对偏移），**不改** `schedule_at`。改规则轨：同时改 `due_at` 与 `schedule_at`（或显式 patch `recurrence`）。RPC：`only_this`（默认 false = 改规则轨；详情 UI 默认 true）。

### History `task_occurrence`

- 每期完成写一条不可变快照：`series_task_id` → live id；`completed_at` / `due_at` / 归属快照；`title`/`content` 复制当期。
- **双向关联**：live → `task.listOccurrences(series_task_id)`；occurrence → `series_task_id` 打开 live。
- 删除 live：**级联软删**其 occurrence。

无 DDL（JSONB + `components[]`）。

## 完成语义（SSOT：`completeTaskItem`）

```
无 recurrence → status=completed + completed_at
有 recurrence → 写 task_occurrence；若 count/until 耗尽则清规则并 completed；
              否则按 anchor 推进 due_at + schedule_at，保持 pending，清 last_notified_at
skip → 只推进，不写 occurrence，不减 count
completeForever → 写 occurrence（若有规则）+ 清 recurrence + completed
```

所有入口必须收敛到上述语义：

| 入口                                  | 行为                                               |
| ------------------------------------- | -------------------------------------------------- |
| `task.complete` / LLM `task_complete` | → `completeTaskItem`                               |
| `task.patch({ status: completed })`   | 服务端委托 `completeTaskItem`                      |
| Offline 勾选完成                      | 出站 `task.complete`；有 recurrence 时本地乐观滚动 |

另：`task.skip` / `task.completeForever` / `task.listOccurrences`。

## 智能清单「已完成」

重复 live 完成后不再停留在 `completed`，故「今日/昨日完成」须 **并集**：

1. `task_item`（一次性已完成）
2. `task_occurrence`（重复打勾历史）

实现：`listCompletedActivity`（domain）；列表 RPC 在 `status=completed` + `completed_on*` 时走并集。occurrence 行：`id = series_task_id`，带 `occurrence_id`。

## v1 边界（non-goals）

- 不做独立 template 实体、预创建未来期、完整 RRULE
- 日历「显示全部周期」属后续（如 #14576）
- 不做跨时区多日历；日界与现有任务筛选一致（Asia/Shanghai）

## 相关代码

- Schema：`task-item.ts` / `task-occurrence.ts` / `task-recurrence.ts`
- Domain：`item-store.ts` / `occurrence-store.ts` / `completed-activity.ts`
- RPC：`src/shared/rpc-contract/frames/task.ts`
