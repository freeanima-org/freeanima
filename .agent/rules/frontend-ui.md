# 前端 UI — Agent 硬约束（shadcn / Tailwind v4）

> **UI/UX 规范 SSOT** → [`docs/ui/`](../../docs/ui/overview.md)（dimensions / foundations / components / patterns）。  
> 三维度 API → [`ui-dimensions.md`](ui-dimensions.md)。  
> 功能原型与包边界 → [`frontend-features.md`](frontend-features.md)。  
> 样式栈：**Tailwind CSS v4 + shadcn/ui**（`@freeanima/ui-kit`）。**禁止 DaisyUI。**

视觉 / 组件 / 交互均须按壳·布局·交互三维适配（见 docs）；本文件只保留实现禁令与落点。

## 分层 → 代码（速查）

| 层级 | 位置                                  |
| ---- | ------------------------------------- |
| 基元 | `@freeanima/ui-kit` → `components/ui` |
| 结构 | `@freeanima/ui-kit/form`、`layout`    |
| 复合 | `@freeanima/ui-kit/composite`         |
| 领域 | `features/*/ui`                       |

详解 → [`docs/ui/components.md`](../../docs/ui/components.md)。

## 主题与 CSS

- Token SSOT：[`src/ui-kit/styles/globals.css`](../../src/ui-kit/styles/globals.css)（`:root` / `.dark`；强调色 `.dark[data-color-theme="…"]`）
- SPA：`@import "tailwindcss"` + `@import "@freeanima/ui-kit/styles/globals.css"` + `@source`；safe-area 时再 `@import "@freeanima/ui-kit/styles.css"`
- app-frame styles：`@source` 扫整棵 `src`（见 `app-frame/spa/styles.css`）
- **禁止**在 `globals.css` 外裸写 `var(--background)` 等主题色；用 Tailwind class / `@apply bg-background`
- 布局裸 CSS（`shared-safe-area.css`）只放 position / safe-area，**不放主题色**
- 暗色：根节点 `.dark`；强调色 `data-color-theme`（`neutral` / `ocean` / `forest` / `sunset` / `violet`）— **禁止** DaisyUI `data-theme`

语义与三维适配 → [`docs/ui/foundations.md`](../../docs/ui/foundations.md)。

## 基元 / 复合（必须遵守）

| 场景         | 做法                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| 按钮         | `<Button variant size>`                                                                     |
| 表单         | `<Input>` / `<Textarea>` / `<Select>`；默认不自动聚焦（`focusOnMount`）                     |
| Dialog/Sheet | 默认 `onOpenAutoFocus` 阻止聚焦                                                             |
| 空态 / 错误  | `<EmptyState>` / `<StatusAlert>`                                                            |
| 确认         | `<ConfirmDialog>` / `showConfirm`；不可恢复删除二次确认；确认钮**禁止** `autoFocus`         |
| 菜单         | pointer → `ContextMenu`；touch → `ActionSheet`；共享 `ActionSheetItem[]`                    |
| 列表行       | 对齐 [`docs/ui/patterns.md`](../../docs/ui/patterns.md) DataListRow；参考 `TaskItemRowView` |

从 `@freeanima/ui-kit/composite` 导入：`ConfirmDialog`、`showConfirm`、`ActionSheet`、`ContextMenu`、`EmptyState`、`StatusAlert`、`PullToRefresh`。

- **禁止** `window.confirm`
- **禁止**自研 `fixed` + 裸坐标快捷菜单
- **禁止**用壳类型或视口宽度选择 ContextMenu vs ActionSheet（用交互 capability）

## 模式 → 代码

| 模式               | 落点                                                       |
| ------------------ | ---------------------------------------------------------- |
| DataListRow        | `ui-kit/composite/TaskItemRowView`（参考；通用抽离另任务） |
| OverflowMenu       | `ContextMenu` / `ActionSheet` / `useLongPress`             |
| ConfirmDestructive | `ConfirmDialog` / `showConfirm`                            |
| ModalSheetPresent  | `Dialog` / `Sheet`；布局维切换呈现                         |
| PullToRefresh      | `PullToRefresh`；见 `docs/aspects/page-refresh.md`         |

## 静态检查

- `just qa stylelint`：DaisyUI 遗留 token + 主题色裸 `var()`（`stylelint.config.js`）

## 其它速记

- 布局：`useLayoutMode` / `useCompactLayout` / `useDrawerNav`
- 交互：`useContextMenuCapability` / `useActionSheetCapability` / `useEnterToSendCapability`
- 壳：`getShellKind` / `canOpenHabitatSettings`；**禁止**用壳锁主布局
- 多列：`columnSplitKey` → `freeanima:column-splits:<key>`
- 模块可见性：`shell-module-visibility.ts`；`chat` / `settings` 不可关
- `ListDetailLayout` drawer 颜色用 Tailwind class，不在 safe-area CSS 写主题色

## 禁止

- DaisyUI class / `--color-base-*` / `data-theme`
- 在 `ui-kit` 内 import `rpc-contract`、Habitat API
- 在 app-frame 内深路径 import feature 源码（走 package export）
