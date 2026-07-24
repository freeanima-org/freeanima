# Tauri Portal 壳

> 桌面 + Android 统一 **Tauri**（Rust 主进程 + 系统 WebView）。UI 仍是 `web/dist-*` / companion spa。

## 工程位置

| 路径                      | 作用                                              |
| ------------------------- | ------------------------------------------------- |
| `src/app/shell/tauri/`    | 统一 Portal：`src-tauri` + bridge + lib/spa       |
| `src/frontend/shell-sdk/` | `ShellApi` / `getShellKind()`（`web` \| `tauri`） |

开发：`just tauri` / `bun run dev:tauri`（桌面）；`just android` / `bun run debug:android`（移动）。  
打包：`just pack-tauri` / `just pack-tauri-windows`；`just pack-android`（Tauri APK）。  
CI / 本地 release profile 优先级：**构建速度 > 体积 > 运行速度**（无 fat LTO；详见 [`release.md`](release.md)「Tauri 打包加速约定」）。

## 强制策略

1. **产品逻辑 TypeScript-only**（Habitat / features）；壳主进程 **Rust only** — 不在壳内跑 Node/Bun 业务进程。
2. **禁止 Node sidecar**：companion `remote_tools.attach` 在 **overlay WebView**；壳只提供窗 / IPC / FS / 通知。
3. **`ShellApi` 注入**：`isTauri: true`、`isNativeShell: true`；桌面 `primaryInput: "pointer"`；移动 `primaryInput: "touch"`。
4. **禁止**用 `getShellKind() === "tauri"` 锁布局（三维度规则 → [`ui-dimensions.md`](ui-dimensions.md)）。
5. 编译期壳目标：`FREEANIMA_SHELL_TARGET=desktop|mobile` → `dist-desktop` / `dist-mobile`；打包前 `scripts/prepare-tauri-ui.ts` 拷入 `src-tauri/ui/web`。
6. Habitat URL + token 存壳 prefs（Rust `desktop-shell.json` / Tauri store）。

## Companion（桌面）

- 主窗：shell-ui（Chat / Settings）。
- overlay：透明 always-on-top；局部 click-through；巡逻 / 拖拽经 Tauri command。
- overlay 自持 Habitat RPC + `remote_tools.attach`；**无** localhost Node HTTP host。

## 移动与小组件

- Android：通知、prefs、APK 覆盖更新（Rust 侧逐步补齐）。
- 主屏小组件 MVP：番茄钟（`pomodoro-active` + `set_pomodoro_widget_state`）。

## 禁止

- 为迁壳重写 Habitat / 产品 features。
- 把 Android AppWidget 与桌面 companion overlay 做成同一套 UI 抽象。
- 重新引入 Electron / Capacitor 双轨工程。
