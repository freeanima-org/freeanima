---
name: acp-cursor
description: 编排 acp_cursor 多轮交互（Plan / Ask / Agent、clarify 决策、continue_session 续用）
created: 2026-06-06
---

# ACP Cursor 编排

使用 `acp_cursor` 委托 Cursor 编码代理时的多轮流程指南。

## 模式选择

| mode    | 用途                     | 示例                                        |
| ------- | ------------------------ | ------------------------------------------- |
| `ask`   | 只读分析，不修改文件     | 「这段代码什么意思」「排查这个 bug 的原因」 |
| `plan`  | 先出方案，等人审批再动手 | 「重新设计 API 层」「大规模重构方案」       |
| `agent` | 直接修改代码、执行命令   | 「实现这个函数」「修复测试」                |

## 基本用法

```text
acp_cursor(prompt="...", mode="agent", context="项目路径与约束")
```

续用同一 Cursor session（回答问题、批准方案、继续执行）：

```text
acp_cursor(prompt="...", continue_session=true, mode="agent")
```

## 阻塞交互（pending）

当返回 JSON 含 `pending` 字段时，表示 Cursor 在等待决策：

### pending 含 questions

1. 阅读 `pending[].questions` 中的选项
2. **有足够上下文** → 自主选择答案，用 `continue_session=true` 将答案作为 `prompt` 发回
3. **需要核对天空** → 调用 `clarify` 工具提问，收到回复后再 `continue_session=true` 继续

### pending 含 plan

1. 阅读 `pending[].plan` 中的方案
2. **可接受** → `continue_session=true, mode=agent`，prompt 说明「已批准，请执行方案」
3. **需修改或需天空确认** → `clarify` 或直接在 prompt 中给出修改意见

## 推荐流程

### 执行型（重构、实现）

1. `acp_cursor(prompt, mode=plan)` → 拿 plan，可能有 questions
2. 处理 questions（自主或 clarify）
3. `acp_cursor(prompt=批准/回答, continue_session=true, mode=agent)` → 执行

### 调研型（代码分析）

1. `acp_cursor(prompt, mode=ask)` → 只读，直接返回分析

### 混合型（先看再改）

1. `acp_cursor(prompt, mode=ask)` → 调研
2. 判断是否需要修改
3. 需要 → `acp_cursor(prompt=改动描述, continue_session=true, mode=agent)`

## 注意

- `continue_session` 会自动取当前逸灵风对话绑定的 Cursor session，无需手动传 `session_id`
- `new_session=true` 强制新开 session（旧 binding 会被替换）
- Cursor todo（`update_todos`）是 Cursor 内部执行检查点，与逸灵风任务系统无关
