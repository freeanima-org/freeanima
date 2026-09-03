---
title: 文档索引
---

# 文档/

面向 **FreeAnima 用户** 与栖息地 Agent（`freeanima_docs` ToolSet）。贡献者规则见
[`.cursor/rules/`](../.cursor/rules/agent-bootstrap.mdc)。任务见 [GitHub
Issues](https://github.com/freeanima-org/freeanima/issues)。

**Agent 提示：** 先 `toolset_load(["freeanima_docs"])`，再优先对 `README.md` 调用 `freeanima_docs_get`，或用 `freeanima_docs_list` 加路径 `prefix`（`product/`、`cognition/`、`ui/`、`aspects/`、`modules/`、`tools/`、`ops/`）。

## 产品 — 产品框架与数据模型

| 主题      | 文件                                               |
| --------- | -------------------------------------------------- |
| 架构      | [product/architecture.md](product/architecture.md) |
| 身份定位  | [product/identity.md](product/identity.md)         |
| 实体模型  | [product/entity-model.md](product/entity-model.md) |
| Anima URI | [product/anima-uri.md](product/anima-uri.md)       |

## 认知 — 数字生命如何思考

| 主题     | 文件                                                                     |
| -------- | ------------------------------------------------------------------------ |
| 记忆     | [cognition/memory.md](cognition/memory.md)                               |
| 压缩     | [cognition/compression.md](cognition/compression.md)                     |
| 睡眠     | [cognition/sleep.md](cognition/sleep.md)                                 |
| 梦境     | [cognition/dream.md](cognition/dream.md)                                 |
| 自我层   | [cognition/self-layer.md](cognition/self-layer.md)                       |
| 时间感知 | [cognition/time-perception.md](cognition/time-perception.md)             |
| 时间摘要 | [cognition/temporal-summary.md](cognition/temporal-summary.md)           |
| 回忆流程 | [cognition/recall-flow.md](cognition/recall-flow.md)                     |
| 环境感知 | [cognition/environment-awareness.md](cognition/environment-awareness.md) |
| 通知     | [cognition/notifications.md](cognition/notifications.md)                 |

## 设计系统 — UI / UX

| 主题     | 文件                                   |
| -------- | -------------------------------------- |
| 索引     | [ui/overview.md](ui/overview.md)       |
| 三维度   | [ui/dimensions.md](ui/dimensions.md)   |
| 视觉基础 | [ui/foundations.md](ui/foundations.md) |
| 组件     | [ui/components.md](ui/components.md)   |
| 交互模式 | [ui/patterns.md](ui/patterns.md)       |

Agent 硬禁令 / API 速查 →
[`.cursor/rules/frontend-ui.mdc`](../.cursor/rules/frontend-ui.mdc)。

## 切面 — 横切设计切面

| 主题          | 文件                                                         |
| ------------- | ------------------------------------------------------------ |
| Portal 数据面 | [aspects/portal-data-plane.md](aspects/portal-data-plane.md) |
| 离线平台      | [aspects/offline-platform.md](aspects/offline-platform.md)   |
| 页面刷新      | [aspects/page-refresh.md](aspects/page-refresh.md)           |
| 实体修订      | [aspects/entity-revisions.md](aspects/entity-revisions.md)   |

## 模块 — 产品能力模块

| 主题       | 文件                                           |
| ---------- | ---------------------------------------------- |
| 聊天室     | [modules/chat.md](modules/chat.md)             |
| 桌面伴侣   | [modules/companion.md](modules/companion.md)   |
| 编码工作台 | [modules/coding.md](modules/coding.md)         |
| 日记       | [modules/diary.md](modules/diary.md)           |
| 日历       | [modules/calendar.md](modules/calendar.md)     |
| 习惯       | [modules/habit.md](modules/habit.md)           |
| 会话目标   | [modules/goal.md](modules/goal.md)             |
| 项目       | [modules/project.md](modules/project.md)       |
| 移动应用   | [modules/mobile-app.md](modules/mobile-app.md) |

## 工具 — 内置 ToolSet

| 主题           | 文件                                               |
| -------------- | -------------------------------------------------- |
| freeanima_docs | [tools/freeanima-docs.md](tools/freeanima-docs.md) |
| 代码运行时     | [tools/execute-code.md](tools/execute-code.md)     |
| Camofox 浏览器 | [tools/browser.md](tools/browser.md)               |

## 运维 — 部署、安全、连接

| 主题         | 文件                                             |
| ------------ | ------------------------------------------------ |
| 安装         | [ops/install.md](ops/install.md)                 |
| Windows 开发 | [ops/windows-dev.md](ops/windows-dev.md)         |
| 服务         | [ops/service.md](ops/service.md)                 |
| 安全         | [ops/security.md](ops/security.md)               |
| 数据库       | [ops/database.md](ops/database.md)               |
| 远程访问     | [ops/remote-access.md](ops/remote-access.md)     |
| 栖息地 RPC   | [ops/habitat-rpc.md](ops/habitat-rpc.md)         |
| 消息网关     | [ops/message-gateway.md](ops/message-gateway.md) |
