---
title: "Anima URI"
---

# Anima URI

面向壳 UI（深链、浮层、剪贴板）以及**未来** Markdown / 富文本点击处理的稳定、可解析实体定位符。

**协议：** `anima:`（无 `//`）。示例：

```text
anima:42?component=task_item&present=overlay
```

## 动机

- 之后从**文本**（Markdown、通知）识别并打开实体，经 `openEntityResource`
- 今日即可分享 / 深链 / 跨模块打开
- PG / 栖息地中的结构化外键仍是**数字 id** — Anima URI 不是持久化格式

本任务交付：语法 + `parse`/`format` + 浮层注册表 + `task_item` 样例。**尚未：** 聊天室 Markdown 链接拦截。

## 语法

```text
anima:{id}[?component={component}][&present=navigate|overlay]
```

| 部分        | 含义                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `id`        | `entities.id`（正整数）                                                                                 |
| `component` | 作为**视图切面**的组件标签（哪个浮层 / 模块映射）。可选；省略时打开会解析 **`primary_component`**       |
| `present`   | `navigate` = 切换壳模块并选中；`overlay` = 打开已注册浮层。默认依组件而定（如 `task_item` → `overlay`） |

**无短别名**（如 `task` 无效）。取值必须是完整组件名。

**不要使用** `anima://…` 作为规范形式（id 会被误解析为 URL host；`anima://42:task_item` 是非法 URL）。

同一 `id` 配不同 `component=` 可打开**不同**浮层（实体可携带多个 `components[]`）。注册表键是组件标签，不是壳模块 id。

## 分层 vs 持久化

| 层                     | 存储                                     | Anima URI                                                 |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------- |
| PG / 栖息地 body / RPC | 实体 **`id`**（如番茄钟 `task_item_id`） | **永不**作为外键字符串                                    |
| 壳 UI                  | —                                        | `formatAnimaUri` / `parseAnimaUri` / `openEntityResource` |

Anima URI 是**壳 / UI 定位协议**，不是数据库外键。用户撰写的正文里碰巧出现的 `anima:…` 是内容，不是结构化关系。

## 浮层注册

每个可展示组件可 `registerEntityOverlay(component, OverlayComponent)`。  
`present=overlay` → 解析组件（默认 `primary_component`）→ 查注册表 → `EntityOverlayHost`。  
`present=navigate` → 经 `navigateAppModulePath` 将组件映射到壳路径（如 `task_item` → `/tasks?item=…`）。

## 暂不在范围

- `anima:` 的 OS 协议 / intent 处理
- 非实体资源（对话等）
- 在外键字段存储 Anima URI 字符串
- 聊天室完整 Markdown 点击拦截

另见 [`entity-model.md`](entity-model.md)。

## 记忆引用

助手 / 用户消息正文用 `[[anima:{id}]]` 或 `[[anima:{id}?component=semantic_memory]]` 引用实体。聊天室 Markdown 将其转为可点击锚点，调用 `openEntityResource`（`semantic_memory` 默认浮层）。
