---
title: 页面刷新
---

# 页面刷新（sync vs refresh）

> 父切面：[Portal 数据面](portal-data-plane.md)。

前哨 / 入口 UI 用两个不同动词保持数据新鲜。不要与仅更新壳资源的 PWA / 安装器「reload」混为一谈。

## 动词

| 动词        | 何时                                            | 发生什么                                                                                  |
| ----------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **sync**    | 栖息地重连、标签页再次可见、离线同步 toast 重试 | Flush outbox；已 flush 的模块调用 `refreshAll`（见 [离线平台](offline-platform.md)）      |
| **refresh** | 顶栏 **刷新** 按钮或触控下拉刷新                | 重跑该页的 `reload*` / 列表拉取（在线 `withOfflineCache` 已走网络）。按钮与下拉同一处理器 |

## 原则

- **有限自动**：保留 sync + 既有 live 通道（聊天 `stream.*`、`conversation.updated`、`pomodoro.active.changed`、`notification.created`）。不对注意力或列表做全局轮询。outbox 为空时不对每个模块无条件 `refreshAll`。注意力路由 → [通知与提醒](notification-and-reminder.md)。
- 产品列表面**须手动刷新**，以便按需拉取多设备 / Agent 编辑。
- **交互维度**（见 [UI 三维度](../ui/dimensions.md)，Agent API 见 [frontend-ui](../../.cursor/rules/frontend-ui.mdc)）：指针用顶栏按钮；触控主列表另有下拉刷新。壳种类不锁定交互方式。模式说明 → [UI 模式](../ui/patterns.md)（PullToRefresh 候选 / DataListRow 同级表面）。
- **不在范围**：为每个 CRUD 实体做栖息地扇出；引入 React Query **库**（数据面上自建 hooks 可以）；把离线同步 toast 变成页面刷新控件。

## 页面类别

| 类别            | 页面                    | 自动                                                          | 手动                         |
| --------------- | ----------------------- | ------------------------------------------------------------- | ---------------------------- |
| A Stream        | 聊天室                  | SAP stream + 恢复轮询                                         | 顶栏刷新（已有）             |
| B CRUD outbox   | 任务、项目、日记        | 挂载 / 选择 cache-first；本地写后 reload；sync → `refreshAll` | 顶栏 + 下拉刷新              |
| C Hybrid outbox | 番茄钟                  | `pomodoro.active.changed`                                     | 离线 `refreshAll` 配置/统计  |
| D snapshot      | 邮件、通知、梦境、Vault | 挂载 / 依赖加载                                               | 顶栏刷新（绑定列表处可下拉） |
| E Habitat       | Ops 列表                | 进入时加载                                                    | 显式刷新（已有）             |
| F Settings      | 壳设置                  | 打开时加载                                                    | 保存后重读                   |
| G Shell update  | PWA / 安装器            | 更新检查                                                      | Reload / 安装 ≠ 业务刷新     |

## 实现要点

- 共享下拉手势：`@freeanima/ui-kit/composite` `PullToRefresh`（仅触控；忽略靠近左缘的起始，避免与抽屉滑动冲突）。视觉 / 触控目标规范 → [UI 基础](../ui/foundations.md)。
- 文案：`m.habitat_common_refresh` / `m.habitat_common_refreshing`。
- 后续（此处不要求）：outbox 为空时仅对焦点模块做可见性软刷新。
