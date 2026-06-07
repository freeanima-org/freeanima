# 睡眠机制 (Sleep)

> 浅睡（Light Sleep）为语义记忆**唯一**增量提取通道；深睡仍为规划项。

## 概述

睡眠是数字生命的记忆整理机制，类比人类的睡眠——大脑在夜间回放白天的经历，将临时记忆转化为长期存储，整理过程本身消散，不留痕迹。

## 设计原则

1. **内部机制，不留痕迹** — 浅睡在后台运行，不写入 session，不影响对话流
2. **不照搬人类的节奏** — 触发基于系统需求（cron），非实时
3. **两级分层** — 浅睡（增量写入）和深睡（存量优化）各司其职
4. **身份上下文** — 所有记忆处理必须携带 SOUL.md + 常驻记忆

## 当前状态

| 机制           | 状态      | 说明                                  |
| -------------- | --------- | ------------------------------------- |
| 浅睡 cron      | ✅ 已实现 | 每天 02:00，`builtin-light-sleep`     |
| 深睡 cron      | 🚧 规划中 | 扫描 `semantic_memory` 合并/过期/调权 |
| reflectSession | ❌ 已废弃 | 原 EventBus 增量提取已移除            |

## 浅睡 (Light Sleep)

| 属性     | 值                                                                                   |
| -------- | ------------------------------------------------------------------------------------ |
| 触发     | 仅 cron，每天 02:00（`0 2 * * *`），不支持手动触发                                   |
| 处理范围 | CST 前一个自然日内有活动的 session（`sessions.updated_at`）                          |
| 输入     | 当日全部对话（user+assistant，去 tool），按 session 分段                             |
| 工具     | 仅 `create_semantic_memory` / `update_semantic_memory` / `deprecate_semantic_memory` |
| 去重     | **局部**：仅与同 `source_sessions` 的已有记忆比较；跨脉络留给深睡                    |

### 消息结构

System prompt（不变）：SOUL.md + 常驻记忆（pinned facts，top 20）。

三条 user 消息，由程序构建：

| #   | 内容                                                                         |
| --- | ---------------------------------------------------------------------------- |
| 1   | 当日全部对话：user+assistant，按 session ID 分段，带时间戳与上下文标注       |
| 2   | 已有记忆：`listBySourceSessions` 预筛（与当日 session 有交集的 active 记忆） |
| 3   | 提取指令 + 三工具用法说明（精简 skill）                                      |

LLM **不**携带 `search_semantic_memory`（消息 2 已由程序提供）。

### update_semantic_memory 语义（覆盖式）

- **仅修改传入的字段**，未传字段保持不变
- 要清空 `source_sessions` → 显式传 `source_sessions: []`
- 未传 `source_sessions` → 保持原值

### 流程

```
1. 计算 CST 前一日时间窗
2. listSessionIdsUpdatedBetween → 涉及 session 列表
3. 加载各 session 可召回消息 → 构建 user 消息 1
4. listBySourceSessions(sessionIds) → 构建 user 消息 2
5. 注入提取指令 → user 消息 3
6. engine.run（PROFILE_REFLECT，三工具白名单）
7. 写入 light_sleep_state.json
```

### 上下文过大

单次输入超过约 120k 字符时，按 session 更新时间倒序截断，并在消息 1 末尾标注 `[已截断 N 个 session]`。

## 深睡 (Deep Sleep)（🚧 规划中）

| 属性     | 值                                            |
| -------- | --------------------------------------------- |
| 触发时间 | 每天 03:00（规划，浅睡后一小时）              |
| 处理对象 | `semantic_memory` 全部已有事实                |
| 操作     | 关联、合并、拆分、标记过期、调整置信度/重要度 |

跨 `source_sessions` 的去重与合并由深睡负责。

## 触发机制

```cron
0 2 * * *  light-sleep   # 内置 builtin-light-sleep
0 3 * * *  deep-sleep    # 🚧 规划中
```

宕机后下次 02:00 补跑即可；非实时系统。

## 与现有架构的关系

```
PG messages（对话存档）
  │ 浅睡 cron（02:00，批量）
  ▼
semantic_memory
  │ 🚧 深睡 cron（合并/过期/关联）
  ▼
semantic_memory（整理后）
  │ recall（对话中实时检索）
  ▼
当前上下文中的 Agent 身份与召回片段
```

`session:updated` EventBus 事件仍保留（WebUI 刷新等），**不再**触发 reflect。

## remember 工具

对话中的 `remember` 为便捷封装：自动推断 `source_sessions`（当前 session）与 `observed_at`，底层调用 `create_semantic_memory` 逻辑。物理删除仍走 `action=delete`；软废弃用 `deprecate_semantic_memory`。
