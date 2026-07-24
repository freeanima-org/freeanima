# UI 三维度正交模型（壳子 / 布局 / 交互）

> AI 编辑器与人类开发者的共同标准。改前端壳/布局/交互前必读。
> 产品原则摘要见 [`AGENTS.md`](../../AGENTS.md) Platform-native UX；DaisyUI/基元见 [`frontend-ui.md`](frontend-ui.md)。

## Shell vs app frame

| 概念                      | 是什么                                                            | 代码                                                                         |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Shell（壳）**           | Portal 运行时宿主（browser / Tauri；形态 web / desktop / mobile） | `src/app/shell/*`；`portal-sdk` 的 `getShellKind` / `ShellApi` / buildTarget |
| **app frame（应用布局）** | 模块左栏 Rail / 底栏 Tabs、设置页 chrome                          | `src/client/app-frame`（`AppFrame`）；跟视口，**不是** Shell                 |

禁止把 app frame 叫作 Shell；禁止用 Shell 类型推导 Rail/底栏。

## 三维度

| 维度                   | 管什么                                  | 取值                              | 判断方式                                                     | 可变性                           |
| ---------------------- | --------------------------------------- | --------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| **壳子** (shell)       | 能力（原生 API、文件、推送、通知、IPC） | `web` / `tauri`（+ buildTarget）  | 构建时 + runtime（`getShellKind` / `getShellBuildTarget`）   | 固定                             |
| **布局** (layout)      | 渲染（宽屏/窄屏视觉、导航 IA）          | `compact`（窄）/ `expanded`（宽） | CSS `matchMedia`                                             | 实时可变                         |
| **交互** (interaction) | 输入模式                                | `touch` / `pointer`               | `primaryInput` → 媒体查询 `(pointer: fine)`+`(hover: hover)` | 主范式相对固定；媒体查询可跟外设 |

文档口语「移动布局 / 桌面布局」分别对应 `compact` / `expanded`（≠ 手机壳 / 桌面壳）。

## 核心原则

- 三个维度**正交**：任意一个不能推导另外两个
- **禁止** `isMobile = getShellKind() === "tauri"` 这类混写
- **禁止**单个 `isMobile` / `isDesktop` 变量同时控制布局和交互
- 组件按职责选用对应维 API；不要手写 `portalShell.isTauri && matchMedia(...)` 组合驱动交互

## 分层职责

### 壳子 → React Hook / portal-sdk

能力调用走封装；组件不直接用壳类型驱动布局或交互：

| API                                                           | 用途                                 |
| ------------------------------------------------------------- | ------------------------------------ |
| `getShellKind()` / `useShellKind()`                           | 一元壳类型（`web`/`tauri`）          |
| `getShellBuildTarget()`                                       | 编译产物（`web`/`desktop`/`mobile`） |
| `canOpenHabitatSettings()` / `useOpenHubSettingsCapability()` | 是否展示 Habitat 设置入口            |
| `shouldUseNativeShellNavigation()`                            | hash 路由 / 保存后进模块             |

壳不支持的能力返回 `null`/`false`，组件自行降级。

### 布局 → 页面 / app frame

由 CSS `matchMedia` 实时判断，不写死设备类型。app frame 根组件：`AppFrame`。

| API                                                | 用途                    |
| -------------------------------------------------- | ----------------------- |
| `useLayoutMode()` / `detectLayoutMode()`           | `compact` \| `expanded` |
| `useCompactLayout()` / `isCompactLayoutViewport()` | 窄视口（&lt; 768px）    |
| `useDrawerNav()` / `useThreeColumnLayoutMode()`    | 导航 / 三栏档           |

常见布局模式：

- **List-Detail**：宽屏左右分栏，窄屏堆叠 + 路由切换（`ListDetailLayout`）
- **Grid-List**：宽屏多列网格，窄屏单列列表
- **Modal-Sheet**：宽屏居中 Dialog，窄屏底部 Sheet / ActionSheet（呈现由布局决定；触发手势归交互）
- **Sidebar-Drawer**：宽屏固定侧边栏，窄屏汉堡 + Drawer。**布局** compact 下 viewport-fixed 层（如 `list-detail-drawer-*`）须避让 `--app-bottom-nav-h`（与 Notice/More 同约定）；勿抬 z-index 盖住底栏

设置页 chrome（tabs vs 侧栏）：`detectSettingsChromePlatform()`（跟布局粗档）。  
设置 section 字段：`resolveSettingsContentPlatform()`（跟壳子维）。

### 交互 → 纯 UI / 输入范式

| API                                                           | 用途               |
| ------------------------------------------------------------- | ------------------ |
| `hasFinePointerCapability()` / `useFinePointerCapability()`   | 精确指针           |
| `hasTouchPrimaryCapability()` / `useTouchPrimaryCapability()` | 触摸主输入         |
| `useContextMenuCapability()`                                  | 右键菜单           |
| `useActionSheetCapability()`                                  | ActionSheet / 长按 |
| `hasEnterToSendCapability()` / `useEnterToSendCapability()`   | Enter 发送 vs 换行 |

约定：

- touch：大点击区域（≥44px）、无 hover 态、长按 / ActionSheet
- pointer：常规点击、hover、右键 ContextMenu
- Pad 接外接键盘后**交互维不变**（仍为 touch），不因外设改 UI 策略
- 键盘弹出的**触发判断**归交互；WebView resize 差异走壳能力（如 `useKeyboardInset()` 内部自判）

### Pad 设备定位

| 维度 | 值                                            |
| ---- | --------------------------------------------- |
| 壳子 | `web` 或 `tauri`（取决于访问方式）            |
| 布局 | 由屏幕实时决定（横屏→expanded，竖屏→compact） |
| 交互 | **touch**（固定；`primaryInput: "touch"`）    |

## 包与 import

- features / app-ui：从 `@freeanima/client/portal-sdk`（及 `/react`）取壳与交互；从 `@freeanima/ui-kit/layout` 取布局
- **禁止**为壳判断 import `app/shell/web`
- `ui-kit` **不**导出壳判定（`isNativeShell` 在 portal-sdk）

## 旧名 → 新名

| 旧名                          | 新名                           |
| ----------------------------- | ------------------------------ |
| `shell-sdk` 目录/包           | `portal-sdk`                   |
| `shell-ui` 目录/包            | `app-ui`                       |
| `ModuleShell`                 | `AppFrame`                     |
| `isMobileLayoutViewport`      | `isCompactLayoutViewport`      |
| `useMobileLayout`             | `useCompactLayout`             |
| `MOBILE_LAYOUT_MQ`            | `COMPACT_LAYOUT_MQ`            |
| `detectPlatform`              | `detectSettingsChromePlatform` |
| `isMobileDebugConsoleEnabled` | `isNativeDebugConsoleEnabled`  |

## 禁止 / 允许（速查）

| 禁止                                             | 允许                                                    |
| ------------------------------------------------ | ------------------------------------------------------- |
| 用 `getShellKind()` / `isNativeShell` 锁应用布局 | `useLayoutMode()` / `useDrawerNav()`                    |
| 用视口断点决定右键 vs 长按                       | `useContextMenuCapability` / `useActionSheetCapability` |
| 用布局+壳组合决定 Enter 发送                     | `useEnterToSendCapability()`                            |
| 手写三处不同的 Habitat 设置可见性                | `canOpenHabitatSettings()`                              |

## 代码入口

- 壳：[`src/client/portal-sdk/shell-runtime.ts`](../../src/client/portal-sdk/shell-runtime.ts)
- 交互：[`src/client/portal-sdk/shell-capability.ts`](../../src/client/portal-sdk/shell-capability.ts)
- 布局：[`src/ui-kit/layout/viewport.ts`](../../src/ui-kit/layout/viewport.ts)、[`app-ui/spa/layout-mode.ts`](../../src/client/app-frame/spa/layout-mode.ts)
- 应用布局根：[`app-ui/spa/main/AppFrame.tsx`](../../src/client/app-frame/spa/main/AppFrame.tsx)
