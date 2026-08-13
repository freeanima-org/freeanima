---
title: UI 三维度
---

# UI 三维度（壳 / 布局 / 交互）

入口 UI 沿**三个正交维度**设计。视觉基础、组件与交互模式都经此透镜适配。手机尺寸**不**等于 compact 布局；Tauri **不**等于 touch。

Agent API 表与硬禁令 → [`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)。实现入口列于该文；本页是产品叙述。

## 壳 vs 应用布局

| 概念            | 是什么                                                             | 代码                                                                        |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **壳（Shell）** | 入口运行时宿主（browser / Tauri；构建目标 web / desktop / mobile） | `src/portal/app/*`；`portal-sdk`（`getShellKind`、`ShellApi`、buildTarget） |
| **应用布局**    | 模块 Rail / 底栏、设置 chrome                                      | `src/client/app-frame`（`AppFrame`）；跟**视口**，不跟壳                    |

不要把应用布局叫「壳」。不要从壳种类推导 Rail vs 底栏。

## 三维

| 维度     | 控制项                             | 取值                             | 如何判定                                                | 稳定性                 |
| -------- | ---------------------------------- | -------------------------------- | ------------------------------------------------------- | ---------------------- |
| **壳**   | 能力（原生 API、文件、推送、IPC）  | `web` / `tauri`（+ buildTarget） | 构建 + 运行时（`getShellKind` / `getShellBuildTarget`） | 每次安装固定           |
| **布局** | 呈现（宽/窄 chrome、导航信息架构） | `compact` / `expanded`           | CSS `matchMedia`（视口）                                | 随窗口大小变化         |
| **交互** | 输入范式                           | `touch` / `pointer`              | `primaryInput` → `(pointer: fine)` + `(hover: hover)`   | 通常稳定；可随外设变化 |

口语「移动布局 / 桌面布局」指 `compact` / `expanded` —— 不是手机壳 / 桌面壳。

## 核心规则

- 维度**正交**：任一不得蕴含另外两个。
- 禁止：`isMobile = getShellKind() === "tauri"`（或类似混用）。
- 禁止：一个 `isMobile` / `isDesktop` 标志同时驱动布局与交互。
- 组件按职责选 API；不要手写 `isTauri && matchMedia(...)` 来选菜单。

## 各维度驱动什么

### 壳 → 能力（`portal-sdk`）

用于：文件/FS 桥、通知、栖息地设置可见性、hash 导航怪癖、键盘 inset / safe-area 宿主差异。

**不要**用壳种类锁主导航（Rail vs 底栏）、hover 可发现性，或 Enter 发送。

不支持的能力返回 `null` / `false`；UI 降级。

### 布局 → 应用布局与页面结构

用于：compact 底栏 + drawer vs expanded Rail + 多栏；Dialog vs Sheet **呈现**；list-detail 叠放；设置 chrome（tabs vs 侧栏，经 `detectSettingsChromePlatform()`）。

常见布局模式：

- **List-Detail** — expanded 并排；compact 时堆叠 + 路由（`ListDetailLayout`）
- **Grid-List** — 多列 vs 单列
- **Modal-Sheet** — expanded 居中 Dialog；compact 底部 Sheet（呈现 = 布局；手势 = 交互）
- **Sidebar-Drawer** — 固定侧栏 vs 汉堡 + drawer；compact 视口固定层须避开 `--app-bottom-nav-h`

设置**区块字段**可跟壳（`resolveSettingsContentPlatform()`）；设置 **chrome** 跟布局。

### 交互 → 输入范式

用于：ContextMenu vs ActionSheet / 长按；hover 才露出的操作；Enter 发送 vs 换行；最小命中目标。

约定：

- **touch** — 命中目标 ≥44px；无仅 hover 可发现性；长按 / ActionSheet
- **pointer** — hover、右键 ContextMenu
- 平板外接键盘**不**把交互翻成 pointer；策略仍为 touch
- 键盘打开**检测**属交互；WebView 尺寸差异可用壳 helper（如 `useKeyboardInset`）

### 平板示例

| 维度 | 取值                                        |
| ---- | ------------------------------------------- |
| 壳   | `web` 或 `tauri`（用户如何打开入口）        |
| 布局 | 实时视口（横屏 → expanded，竖屏 → compact） |
| 交互 | **touch**（`primaryInput: "touch"`）        |

## 维度适配模板

写视觉、组件或模式规格时，文档化：

1. **维度不变** — 共享契约
2. **按布局** — compact vs expanded（或 N/A）
3. **按交互** — pointer vs touch（或 N/A）
4. **按壳** — 仅能力差异（或 N/A）
5. **禁止混用** — 如壳决定 hover；视口宽度决定 ContextMenu vs ActionSheet

## 相关文档

- 视觉基础 → [foundations.md](foundations.md)
- 组件 → [components.md](components.md)
- 模式 → [patterns.md](patterns.md)
- Agent 规则 → [`.cursor/rules/frontend-ui.mdc`](../../.cursor/rules/frontend-ui.mdc)
