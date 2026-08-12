---
title: "Camofox 浏览器 Profile 与 Session"
---

# Camofox 浏览器 Profile 与 Session

> 浏览器工具经 HTTP 与 Camofox 通信。**Profile** 持有登录态；**session** 是该 profile 下的工作线。

在栖息地设置 → 高级 → **browser** / **camofox** 配置（`habitat_runtime_config` 中的 `browser.camofox.*`）。

## Profile 与 session

| 概念        | 配置 / 字段                                                    | 持有内容                                          |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------- |
| **Profile** | Camofox `userId`（`user_id`，或 `managed_persistence` 时派生） | Cookie、登录、本地存储 — 「谁在浏览」             |
| **Session** | Camofox `sessionKey`（`session_key`，或按栖息地对话派生）      | 该 profile 下的标签页 / 任务线 — 创建并采纳标签页 |

一个 profile 可有多个 session。同 profile + 不同 session 共享登录态，但保持独立标签线。

栖息地 `conversationId` 仅是进程内缓存 Camofox session 对象的映射键；不是 Camofox 的 `sessionKey` 本身（常由其派生）。

## 解析顺序

栖息地对话首次打开 Camofox session 时：

1. **已设 `user_id`** → 用该 profile；有 `session_key` 则用之，否则 `task_` + 对话 id 前缀。忽略 `managed_persistence`。
2. 否则 **`managed_persistence` 不为 false**（默认 **true**）→ 从 `~/.anima/browser_auth/camofox` 得到稳定 `userId`；`sessionKey` 按对话派生。
3. 否则（`managed_persistence: false`）→ 临时随机 `userId` — 无持久 profile。

单独设 `session_key` 无效；仅在已设 `user_id` 时生效。

## 字段

| 字段                  | 默认（未设时） | 含义                                                   |
| --------------------- | -------------- | ------------------------------------------------------ |
| `base_url`            | （工具必需）   | Camofox REST 基址                                      |
| `timeout_ms`          | `30000`        | 单次 HTTP 超时                                         |
| `managed_persistence` | `true`         | 未设 `user_id` 时复用稳定本地 profile                  |
| `adopt_existing_tab`  | `true`         | 重启后尝试为同一 profile/session 采纳已有标签页        |
| `user_id`             | 未设           | 显式 Camofox profile id（最高优先级）                  |
| `session_key`         | 未设           | 该 profile 下的显式 session key（仅与 `user_id` 同用） |

未设的布尔视为**开**（`!== false`）。显式设为 `false` 以关闭。

## 按次 profile（`browser_navigate.user_id`）

`browser_navigate` 接受可选 `user_id`（Camofox profile）。其他 `browser_*` 工具继续使用该对话缓存的 session。

| 调用                                | 行为                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 省略 `user_id`                      | 若已有对话 session 则复用；否则按栖息地配置解析（上序）                                                                        |
| 传入与缓存 profile 相同的 `user_id` | 在当前标签页导航                                                                                                               |
| 传入不同的 `user_id`                | 丢弃本对话进程内缓存，在该 profile 下打开新标签（`sessionKey` = `task_` + 对话 id 前缀）。**不**远程删除先前的 Camofox profile |

成功导航结果含 `user_id`，便于 Agent 确认当前 profile。先前工具覆盖后省略 `user_id` 会保持该覆盖，直到新建 session（如进程重启或清空 session）才回落到配置。

工具覆盖仅作用于该栖息地对话的缓存。无工具覆盖时，栖息地 `browser.camofox.user_id` 仍为默认。

## 推荐配置

| 目标                          | 配置                                                  |
| ----------------------------- | ----------------------------------------------------- |
| 在本栖息地记住登录（默认）    | 字段留空，或 `managed_persistence: true`              |
| 临时浏览（不共享登录）        | `managed_persistence: false`                          |
| 共享 / 固定某 Camofox profile | 设 `user_id`；仅需固定 session 线时再加 `session_key` |
| 同一对话内切换 profile        | 在 `browser_navigate` 上传入 `user_id`                |

## 另见

实现：`src/host/capabilities/tools/browser-camofox.ts`。
