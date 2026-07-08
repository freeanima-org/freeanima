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

- **主题变量唯一定义处**：[`src/frontend/ui-kit/styles/globals.css`](../../src/frontend/ui-kit/styles/globals.css)（`:root` / `.dark`）
- 各 SPA `styles.css`：`@import "tailwindcss"` + `@import "@freeanima/ui-kit/globals.css"` + `@source`；需要 safe-area 时 `@import "@freeanima/ui-kit/styles.css"`
- **禁止**在 `globals.css` 以外用 `var(--background)`、`var(--muted)` 等写背景/边框/文字色；改用 Tailwind class 或 `@apply bg-background` 等
- **布局类裸 CSS**（`shared-safe-area.css`）只放 position、safe-area（`--sat` 等），**不放主题色**
- 暗色：根节点 `.dark`（shadcn 约定），不用 `data-theme`

## 基元约定

| 场景         | 推荐做法                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| 按钮         | `<Button variant="…" size="…">`                                                                           |
| 表单输入     | `<Input>` / `<Textarea>` / `<Select>`；**默认不自动聚焦**，需要时用 `focusOnMount`                        |
| 对话框/Sheet | `DialogContent` / `SheetContent` 默认 `onOpenAutoFocus` 阻止聚焦；确需打开时聚焦用 `onOpenAutoFocus` 覆盖 |
| 加载         | `<Spinner>`                                                                                               |
| 空态         | `<EmptyState>`                                                                                            |
| 错误/提示    | `<StatusAlert>`                                                                                           |
| 确认对话框   | `<ConfirmDialog>` / `<Dialog>`                                                                            |

## 复合组件

从 `@freeanima/ui-kit/composite` 导入：`ConfirmDialog`、`ActionSheet`、`EmptyState`、`StatusAlert`。

## 静态检查

- `bun run stylelint`：DaisyUI 遗留 token + 主题色裸 `var()`（见根目录 `stylelint.config.js`）

## 平台：布局层 × 能力层（正交）

两个维度**独立**，可组合（例：iPad 宽屏 = **桌面布局** + **触摸能力**）。

### 布局层（仅视口断点）

| 档位      | 视口           | API                                   | 效果                      |
| --------- | -------------- | ------------------------------------- | ------------------------- |
| 移动布局  | `< 768px`      | `useLayoutMode()` → compact           | 底栏 + drawer             |
| 桌面布局  | `≥ 768px`      | expanded                              | 左侧 Rail                 |
| 三栏·两列 | `768px–1027px` | `useThreeColumnLayoutMode()` → medium | 清单 drawer + 中/详情两列 |
| 三栏·三列 | `≥ 1028px`     | `useThreeColumnLayoutMode()` → wide   | 清单 + 中栏 + 详情并列    |

- Shell 导航 IA：**必须** `detectLayoutMode()` / `useDrawerNav()` 分支；**禁止**用 `isElectron` / `isNativeShell` 锁 Shell 布局
- 设置页 chrome：`detectPlatform()` 跟布局粗档（compact → mobile tabs，expanded → desktop 侧栏）

### 能力层（终端 / 主输入，与视口无关）

| API                           | 含义                                 |
| ----------------------------- | ------------------------------------ |
| `hasFinePointerCapability()`  | 鼠标/触控板主输入 → 右键 ContextMenu |
| `hasTouchPrimaryCapability()` | 触摸主输入 → ActionSheet / 长按      |
| `satelliteShell.primaryInput` | 可选显式覆盖（`pointer` \| `touch`） |

默认推断：Electron → pointer；Capacitor → touch；Web → `(pointer: fine)` + `(hover: hover)`。

**禁止**用布局断点（如 `<768`）推断右键/长按；**禁止**仅用 `isElectron` 推断布局。

- 产品模块统一使用 `@freeanima/shell-sdk/react`：`useContextMenuCapability()` / `useActionSheetCapability()`；浮动菜单与 ActionSheet 用 `@freeanima/ui-kit/composite` 的 `ContextMenu` / `ActionSheet`；长按触发用 `useLongPress`
- 多列布局（`ThreeColumnLayout` / `ListDetailLayout`）传 `columnSplitKey` 可在中/宽屏拖拽列分割，宽度持久化 `localStorage`（`freeanima:column-splits:<key>`）

- 存储、IPC、settings registry、滑动手势等同属能力层（`satelliteShell`）
- Shell 模块可见性：设置 → 模块，**localStorage**（`shell-module-visibility.ts`）；`chat` / `settings` 不可关
- `ListDetailLayout` drawer 颜色在 TSX 用 `bg-background`、`bg-black/55` 等 class，不在 `shared-safe-area.css` 写背景

## 禁止

- DaisyUI class / `--color-base-*` / `data-theme`
- 在 `ui-kit` 内 import `sap-contract`、Hub API
- 在 `shell-ui` 内深路径 import satellite 源码（走 package export）
