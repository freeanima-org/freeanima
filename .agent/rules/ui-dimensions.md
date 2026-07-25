# UI 三维度 — Agent 硬约束

> 产品叙述与三维适配模板 → [`docs/ui/dimensions.md`](../../docs/ui/dimensions.md)。  
> 视觉 / 组件 / 交互规范 → [`docs/ui/`](../../docs/ui/README.md)。  
> 改前端壳/布局/交互前必读 docs；本文件只保留 **禁止项 + API 入口**。

## Shell vs app frame（速记）

| 概念          | 是什么                    | 代码                                 |
| ------------- | ------------------------- | ------------------------------------ |
| **Shell**     | Portal 运行时宿主         | `src/portal/app/*`；`portal-sdk`     |
| **app frame** | Rail / 底栏 / 设置 chrome | `src/client/app-frame`（`AppFrame`） |

禁止把 app frame 叫作 Shell；禁止用 Shell 类型推导 Rail/底栏。

## 禁止 / 允许

| 禁止                                             | 允许                                                    |
| ------------------------------------------------ | ------------------------------------------------------- |
| 用 `getShellKind()` / `isNativeShell` 锁应用布局 | `useLayoutMode()` / `useDrawerNav()`                    |
| 用视口断点决定右键 vs 长按                       | `useContextMenuCapability` / `useActionSheetCapability` |
| 用布局+壳组合决定 Enter 发送                     | `useEnterToSendCapability()`                            |
| 手写多处不同的 Habitat 设置可见性                | `canOpenHabitatSettings()`                              |
| 单个 `isMobile` / `isDesktop` 同时锁布局和交互   | 按维选用下表 API                                        |
| 为壳判断 import `portal/app/web`                 | `@freeanima/client/portal-sdk`（及 `/react`）           |
| `ui-kit` 导出壳判定                              | 壳判定仅 portal-sdk                                     |

## API 速查

### 壳 → portal-sdk

| API                                                           | 用途                         |
| ------------------------------------------------------------- | ---------------------------- |
| `getShellKind()` / `useShellKind()`                           | `web` / `tauri`              |
| `getShellBuildTarget()`                                       | `web` / `desktop` / `mobile` |
| `canOpenHabitatSettings()` / `useOpenHubSettingsCapability()` | Habitat 设置入口             |
| `shouldUseNativeShellNavigation()`                            | hash 路由 / 保存后进模块     |

### 布局 → ui-kit/layout + app-frame

| API                                                | 用途                    |
| -------------------------------------------------- | ----------------------- |
| `useLayoutMode()` / `detectLayoutMode()`           | `compact` \| `expanded` |
| `useCompactLayout()` / `isCompactLayoutViewport()` | 窄视口（&lt; 768px）    |
| `useDrawerNav()` / `useThreeColumnLayoutMode()`    | 导航 / 三栏             |

设置 chrome：`detectSettingsChromePlatform()`（布局粗档）。  
设置 section 字段：`resolveSettingsContentPlatform()`（壳维）。

### 交互 → portal-sdk

| API                                                           | 用途               |
| ------------------------------------------------------------- | ------------------ |
| `hasFinePointerCapability()` / `useFinePointerCapability()`   | 精确指针           |
| `hasTouchPrimaryCapability()` / `useTouchPrimaryCapability()` | 触摸主输入         |
| `useContextMenuCapability()`                                  | 右键菜单           |
| `useActionSheetCapability()`                                  | ActionSheet / 长按 |
| `hasEnterToSendCapability()` / `useEnterToSendCapability()`   | Enter 发送 vs 换行 |

约定摘要：touch ≥44px、无 hover-only；pointer 可用 hover / ContextMenu。Pad + 外接键盘时交互维仍为 touch。

## 包与 import

- features / app-frame：壳与交互 → `@freeanima/client/portal-sdk`；布局 → `@freeanima/ui-kit/layout`
- `ui-kit` **不**导出壳判定

## 旧名 → 新名

| 旧名                                         | 新名                                           |
| -------------------------------------------- | ---------------------------------------------- |
| `shell-sdk`                                  | `portal-sdk`                                   |
| `shell-ui` / `app-ui`（包名口语）            | `app-frame`（代码目录）                        |
| `ModuleShell`                                | `AppFrame`                                     |
| `isMobileLayoutViewport` / `useMobileLayout` | `isCompactLayoutViewport` / `useCompactLayout` |
| `MOBILE_LAYOUT_MQ`                           | `COMPACT_LAYOUT_MQ`                            |
| `detectPlatform`                             | `detectSettingsChromePlatform`                 |
| `isMobileDebugConsoleEnabled`                | `isNativeDebugConsoleEnabled`                  |

## 代码入口

- 壳：[`src/client/portal-sdk/shell-runtime.ts`](../../src/client/portal-sdk/shell-runtime.ts)
- 交互：[`src/client/portal-sdk/shell-capability.ts`](../../src/client/portal-sdk/shell-capability.ts)
- 布局：[`src/ui-kit/layout/viewport.ts`](../../src/ui-kit/layout/viewport.ts)、[`app-frame/spa/layout-mode.ts`](../../src/client/app-frame/spa/layout-mode.ts)
- 应用布局根：[`app-frame/spa/main/AppFrame.tsx`](../../src/client/app-frame/spa/main/AppFrame.tsx)
