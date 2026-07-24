# 前端 UI 规范（shadcn / Tailwind v4）

> 与 [`frontend-features.md`](frontend-features.md) 包边界规则配合。样式栈：**Tailwind CSS v4 + shadcn/ui**（`@freeanima/ui-kit`）。

## 分层

| 层级     | 做法                                      | 位置                               |
| -------- | ----------------------------------------- | ---------------------------------- |
| **基元** | `@freeanima/ui-kit` shadcn 原语 + variant | 各 satellite / admin / shell-ui    |
| **结构** | 表单/布局封装                             | `@freeanima/ui-kit/form`、`layout` |
| **复合** | 跨域重复交互模式                          | `@freeanima/ui-kit/composite`      |
| **领域** | 产品专属 UI                               | 各业务包本地                       |

## 主题与 CSS

- **主题变量唯一定义处**：[`src/frontend/ui-kit/styles/globals.css`](../../src/frontend/ui-kit/styles/globals.css)（`:root` / `.dark`；强调色变体 `.dark[data-color-theme="…"]`）
- 各 SPA `styles.css`：`@import "tailwindcss"` + `@import "@freeanima/frontend/ui-kit/styles/globals.css"` + `@source`；需要 safe-area 时 `@import "@freeanima/frontend/ui-kit/styles.css"`
- **壳 UI**：[`shell-ui/spa/styles.css`](../../src/frontend/shell-ui/spa/styles.css) 用 `@source "../../../../src/**/*.{tsx,ts}"` 扫整棵 `src`（含各 feature SPA）；独立 SPA（如 chat 自己的 `styles.css`）仍各自 `@source`
- **禁止**在 `globals.css` 以外用 `var(--background)`、`var(--muted)` 等写背景/边框/文字色；改用 Tailwind class 或 `@apply bg-background` 等
- **布局类裸 CSS**（`shared-safe-area.css`）只放 position、safe-area（`--sat` 等），**不放主题色**
- 暗色：根节点 `.dark`（shadcn 约定）；强调色用 `data-color-theme`（`neutral` / `ocean` / `forest` / `sunset` / `violet`，本机偏好见 `shell-sdk/color-theme`），**禁止** DaisyUI `data-theme`

## 基元约定

| 场景         | 推荐做法                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 按钮         | `<Button variant="…" size="…">`                                                                                                                                                                    |
| 表单输入     | `<Input>` / `<Textarea>` / `<Select>`；**默认不自动聚焦**，需要时用 `focusOnMount`                                                                                                                 |
| 对话框/Sheet | `DialogContent` / `SheetContent` 默认 `onOpenAutoFocus` 阻止聚焦；确需打开时聚焦用 `onOpenAutoFocus` 覆盖                                                                                          |
| 加载         | `<Spinner>`                                                                                                                                                                                        |
| 空态         | `<EmptyState>`                                                                                                                                                                                     |
| 错误/提示    | `<StatusAlert>`                                                                                                                                                                                    |
| 确认对话框   | `<ConfirmDialog>` / `showConfirm`；**不可恢复删除必须**二次确认（`variant="error"`）；确认钮**不做默认聚焦/默认选中**（沿用 Dialog/Sheet 默认 `onOpenAutoFocus` 阻止；禁止给确认钮加 `autoFocus`） |

## 复合组件

从 `@freeanima/ui-kit/composite` 导入：`ConfirmDialog`、`showConfirm`、`ActionSheet`、`EmptyState`、`StatusAlert`、`PullToRefresh`。禁止 `window.confirm`。

## 静态检查

- `just qa stylelint`：DaisyUI 遗留 token + 主题色裸 `var()`（见根目录 `stylelint.config.js`）

## 平台（壳子 × 布局 × 交互）

三维度正交标准与 API → [**`ui-dimensions.md`**](ui-dimensions.md)。本文件只保留 DaisyUI / 基元约定。

速记：

- 布局：`useLayoutMode` / `useCompactLayout` / `useDrawerNav`（视口断点）
- 交互：`useContextMenuCapability` / `useActionSheetCapability` / `useEnterToSendCapability`
- 壳：`getShellKind` / `canOpenHabitatSettings`；**禁止**用壳类型锁主布局
- 多列布局可传 `columnSplitKey` 拖拽列宽（`freeanima:column-splits:<key>`）
- Shell 模块可见性：`shell-module-visibility.ts`；`chat` / `settings` 不可关
- `ListDetailLayout` drawer 颜色用 Tailwind class，不在 `shared-safe-area.css` 写主题色

## 禁止

- DaisyUI class / `--color-base-*` / `data-theme`
- 在 `ui-kit` 内 import `rpc-contract`、Habitat API
- 在 `shell-ui` 内深路径 import satellite 源码（走 package export）
