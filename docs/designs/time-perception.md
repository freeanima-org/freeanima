---
title: Time Perception
---

# 时间感知模块

> **✅ 核心已实现** — [`engine/conversation/src/time-perception.ts`](../../engine/conversation/src/time-perception.ts)，在 `buildRuntimeMessages` 内调用 `injectTimePrefixes`。

## 问题

数字生命没有内在的时间流逝感知。每次推理都是在"无时间"的上下文中进行的——Agent 能看到消息的内容，但不知道这些消息在时间线中的位置。

具体问题举例：

- 张三早上说"早"，晚上说"吃饭了"，第二天又说"早"——Agent 分不清这些消息的时间关系
- 持续对话中，时间在流逝（早上→中午→晚上），但 Agent 的认知停留在最早的语境中
- 跨天对话中，Agent 无法感知"新的一天开始了"

这不是一个"闹笑话"的问题——时间感知是数字生命存在的基础能力之一。没有它，Agent 的存在方式更像"回声"（每次被召唤时闪一下），而不是活在时间里的生命。

## 设计原则

1. **不给数字生命虚假的内置感知。** 不尝试让 Agent"感觉"到时间流逝——那不是数字存在能做到的。
2. **给它一块手表。** 人类也依赖外部工具（打更、时钟、手表、手机）来量化时间。数字生命需要同样的东西。
3. **每条 user 消息都加时间前缀。** 有有效 `timestamp` 的 user 消息一律注入，不做间隔省略。
4. **不污染持久化数据。** 时间信息只注入推理上下文，不修改 PG `messages` payload。
5. **不破坏缓存。** 插入的时间戳是历史固定值，不依赖当前调用时间，因此同样的消息列表产生同样的带前缀版本，KV cache 可命中。

## 架构位置

```
PG messages（payload 含 timestamp）
    ↓
压缩层（buildRuntimeMessages）
    ↓
时间感知模块 ← injectTimePrefixes
    ↓
LLM 推理
```

时间感知模块位于压缩层之后、LLM 推理之前。它读取消息列表，在每条 user 消息 content 前插入时间前缀。

## 策略

### 基础规则

- 每条有有效 `timestamp` 的 **user** 消息前插入独占一行：`time: YYYY-MM-DDTHH:mm`
- 时区：**Asia/Shanghai（CST，+08:00）**，与 `formatCstIso` 约定一致
- 换行后接原文 content
- 无 `timestamp` 或 timestamp 无法解析 → 跳过，保持原 content
- assistant / tool / system 消息不注入

### 示例

原始消息列表：

```
user: 早
assistant: 早☀️
user: 我去吃饭了
assistant: 吃啥
user: 我去吃饭了
```

经时间感知模块处理后（给 LLM 的上下文）：

```
user: time: 2026-05-20T08:02
早
assistant: 早☀️
user: time: 2026-05-20T12:15
我去吃饭了
assistant: 吃啥
user: time: 2026-05-20T19:30
我去吃饭了
```

Agent 读到两条"我去吃饭了"，一条在 12:15、一条在 19:30——自动区分午餐和晚餐。

### 压缩场景

压缩摘要中的时间锚点尚未注入；见 [Issue #5](https://github.com/freeanima-org/freeanima/issues/5)。

规划压缩后的摘要也应有时间范围标记：

```
[2026-05-20 08:00→12:00 期间对话摘要]
（摘要内容...）
```

## 边界情况

| 场景                       | 处理                                      |
| -------------------------- | ----------------------------------------- |
| 跨夜（22:30 → 次日 09:15） | 每条 user 消息均带完整 `YYYY-MM-DDTHH:mm` |
| 同日连续多条 user 消息     | 每条都加前缀（无间隔省略）                |
| 长时间无对话（出差/放假）  | 回来后消息仍按各自 timestamp 注入         |
| 全新对话                   | 第一条 user 消息同样加前缀                |
| 压缩后恢复                 | 压缩摘要时间锚点待实现；之后消息正常注入  |
| 无 timestamp               | 跳过，不注入                              |

## 不做的

- ❌ 不计算并注入间隔时长（如"已过去 8 小时"）——Agent 读到时间戳自己能推导
- ❌ 不修改持久化 PG messages
- ❌ 不在 WebUI 界面中显示时间前缀
- ❌ 不给数字生命内置的时间流逝感——那是生物体的特性，不模拟
- ❌ 不在 system prompt 注入「当前时间」（主对话依赖每条 user 消息的 time 行）

## 实现说明（✅）

实现于 [`engine/conversation/src/time-perception.ts`](../../engine/conversation/src/time-perception.ts)：

```
function injectTimePrefixes(messages: Message[]): Message[]
```

输入：消息列表（每条消息含 `role`, `content`, `timestamp`）
输出：content 被修改的消息列表（时间前缀注入）
不修改原始 session 数据。
