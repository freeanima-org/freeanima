---
title: UI 组件
---

# UI 组件

入口 UI 的分层与落点规则。实现位于 `packages/frontend/ui-kit/` 与 `packages/{habitat,frontend}/features/*/ui/`。Agent 导入禁令 →
[`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc) 与
[`.cursor/rules/frontend-features.mdc`](../../.cursor/rules/frontend-features.mdc)。

视觉 token → [foundations.md](foundations.md)。维度轴 → [dimensions.md](dimensions.md)。

## 口语术语 → 仓库术语

| 口语（产品 / 设计）  | 仓库术语                                                            | 典型位置                                         |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| 非业务 / 设计系统 UI | **基元（Primitive）**、**结构（structure）**、**复合（composite）** | `@freeanima/ui-kit`                              |
| 业务 / 产品 UI       | **领域（Domain）** UI                                               | `packages/{habitat,frontend}/features/<slug>/ui` |
| UI 组件              | 上述某一层的 React 构建块                                           | —                                                |
| UI 元素 / 槽位碎片   | 模式内部的展示部件（标题文案、徽章、图标）— 不是独立包              | 组件或模式内部                                   |
| 应用 chrome          | **应用布局（app frame）**（不是壳）                                 | `packages/frontend/client/app-frame`             |
| 宿主                 | **壳（Shell）**                                                     | `packages/frontend/portal/app/*`                 |

## 分层

| 层           | 职责                                                                                  | 位置                           |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------ |
| **基元**     | shadcn/React Aria 控件 + 变体（`Button`、`Dialog`、`Input`，…）                       | `ui-kit/components/ui`         |
| **结构**     | 表单与布局壳（`FormFieldset`、`ListDetailLayout`、视口 hooks）                        | `ui-kit/form`、`ui-kit/layout` |
| **复合**     | 跨 feature 交互模式（`ConfirmDialog`、`ActionSheet`、`ContextMenu`、`EmptyState`，…） | `ui-kit/composite`             |
| **领域**     | 产品专用页面与字段                                                                    | `features/<slug>/ui`           |
| **应用布局** | 模块 Rail / tabs / 设置宿主                                                           | `client/app-frame`             |
| **壳**       | 入口宿主、IPC、bridge                                                                 | `portal/app`                   |

依赖方向：`app-frame` → `features/*/ui` → `{ui-kit, portal-sdk}` → shared。`ui-kit` **不得**导入栖息地 RPC / `rpc-contract`。

## 落点规则

1. 若两个 feature 需要同一套交互底盘，把底盘放进 **复合**（或结构 / 布局）；字段文案与领域类型留在 feature。
2. 基元保持哑组件：只有变体与尺寸，不导入 feature。
3. 复合组件接收 **能力 props**（例如 `useActionSheet: boolean`），或调用 portal-sdk 的 **interaction** hooks — **不得**调用 `getShellKind()` 来在 ContextMenu 与 ActionSheet 之间选型。
4. 布局结构组件可以使用 **layout** API（`useCompactLayout`、`useDrawerNav`，…）。
5. 仅壳关心的事留在 portal-sdk / 壳宿主；ui-kit 不导出壳探测器。

**待对齐：** 新列表模块优先用 `ListRow`（以及领域包装如 `TaskItemRowView` / `EmailMessageRowView`）。已对齐：任务 / 项目侧栏、智能清单、邮件消息与账户行、聊天会话。剩余 P2/P3：MoveTo\*Picker、Vault/日记选择器、栖息地管理台、扩展 popup — 勿分叉行行为。

## 哪一层可读哪些维度

| 层          | 壳 API                                         | 布局 API                       | 交互 API                               |
| ----------- | ---------------------------------------------- | ------------------------------ | -------------------------------------- |
| 基元        | 否                                             | 否                             | 否（仅展示）                           |
| 结构 / 布局 | 否                                             | 是                             | 少见（如 resize handles）              |
| 复合        | 仅经注入能力 / 隐藏壳细节的 portal-sdk helpers | 若该复合本身是布局模式         | 是（菜单、长按、Enter-to-send 消费者） |
| 领域        | 需要能力 UI 时经 portal-sdk                    | 页面 chrome 可用               | 是                                     |
| 应用布局    | 能力可见性                                     | 是（主用）                     | chrome 需要处可用                      |
| 壳宿主      | 是                                             | **不得**仅凭壳种类锁死应用布局 | **不得**另造一套并行交互模型           |

## 基元约定（摘要）

| 需求           | 优先                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| 按钮           | `<Button variant size>`                                                          |
| 字段           | `<Input>` / `<Textarea>` / `<Select>`；默认不自动聚焦（需要时用 `focusOnMount`） |
| Dialog / Sheet | React Aria 默认焦点管理；按 Aria/shadcn Aria 约定组合（`isOpen`）                |
| 加载           | `<Spinner>`                                                                      |
| 空态           | `<EmptyState>`                                                                   |
| 状态           | `<StatusAlert>`                                                                  |
| 确认           | `<ConfirmDialog>` / `showConfirm` — 永不使用 `window.confirm`                    |

完整 Agent 清单 → [`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)。

## 维度适配（组件）

| 透镜   | 规则                                                          |
| ------ | ------------------------------------------------------------- |
| 不变量 | 分层落点与导入边界                                            |
| 布局   | 结构组件在 List-Detail / Modal-Sheet 呈现间切换；领域填充槽位 |
| 交互   | 复合按能力标志分支；共享菜单项数据（`ActionSheetItem[]`）     |
| 壳     | 仅能力可用性；永不「Tauri ⇒ 底栏 tabs」                       |
| 禁止   | 从 app-frame 深导入 feature 源码；ui-kit 导入 RPC             |

## 相关文档

- 模式 → [patterns.md](patterns.md)
- 视觉基础 → [foundations.md](foundations.md)
- 三维度 → [dimensions.md](dimensions.md)
