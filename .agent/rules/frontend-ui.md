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

- **主题变量唯一定义处**：[`packages/ui-kit/src/styles/globals.css`](../packages/ui-kit/src/styles/globals.css)（`:root` / `.dark`）
- 各 SPA `styles.css`：`@import "tailwindcss"` + `@import "@freeanima/ui-kit/globals.css"` + `@source`；需要 safe-area 时 `@import "@freeanima/ui-kit/styles.css"`
- **禁止**在 `globals.css` 以外用 `var(--background)`、`var(--muted)` 等写背景/边框/文字色；改用 Tailwind class 或 `@apply bg-background` 等
- **布局类裸 CSS**（`shared-safe-area.css`）只放 position、safe-area（`--sat` 等），**不放主题色**
- 暗色：根节点 `.dark`（shadcn 约定），不用 `data-theme`

## 基元约定

| 场景       | 推荐做法                              |
| ---------- | ------------------------------------- |
| 按钮       | `<Button variant="…" size="…">`       |
| 表单输入   | `<Input>` / `<Textarea>` / `<Select>` |
| 加载       | `<Spinner>`                           |
| 空态       | `<EmptyState>`                        |
| 错误/提示  | `<StatusAlert>`                       |
| 确认对话框 | `<ConfirmDialog>` / `<Dialog>`        |

## 复合组件

从 `@freeanima/ui-kit/composite` 导入：`ConfirmDialog`、`ActionSheet`、`EmptyState`、`StatusAlert`。

## 静态检查

- `bun run stylelint`：DaisyUI 遗留 token + 主题色裸 `var()`（见根目录 `stylelint.config.js`）

## 平台布局

- 导航与主布局 IA：**必须** `detectLayoutMode()` / `useDrawerNav()` 分支（窄视口 ≤1023px 均为 compact + drawer）
- `ListDetailLayout` drawer 颜色在 TSX 用 `bg-background`、`bg-black/55` 等 class，不在 `shared-safe-area.css` 写背景

## 禁止

- DaisyUI class / `--color-base-*` / `data-theme`
- 在 `ui-kit` 内 import `sap-contract`、Hub API
- 在 `shell-ui` 内深路径 import satellite 源码（走 package export）
