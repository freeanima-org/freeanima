# Tauri Portal 壳

> 桌面 + Android 统一 **Tauri**（Rust 主进程 + 系统 WebView）。UI 仍是 `web/dist-*` / companion spa。

## 工程位置

| 路径                     | 作用                                              |
| ------------------------ | ------------------------------------------------- |
| `src/portal/app/tauri/`  | 统一 Portal：`src-tauri` + bridge + lib/spa       |
| `src/client/portal-sdk/` | `ShellApi` / `getShellKind()`（`web` \| `tauri`） |

开发（Win / Linux / mac **同一命令**）：`just dev tauri`（桌面；需 Vite `:5000`）；`just dev tauri-android`（移动）。
打包：

| 配方                      | 含义                                                |
| ------------------------- | --------------------------------------------------- |
| `just pack tauri`         | **当前宿主**桌面壳（Windows→NSIS / Linux→AppImage） |
| `just pack tauri-windows` | Windows 上本机 MSVC；Linux/mac 上交叉 NSIS          |
| `just pack tauri-linux`   | 仅 Linux 本机 AppImage                              |
| `just pack tauri-android` | Android APK                                         |

依赖：`just install tauri`（本机）；交叉 Windows：`just install tauri-windows`（非 Windows 宿主）。
CI / 本地 release profile 优先级：**构建速度 > 体积 > 运行速度**（无 fat LTO；详见 [`release.md`](release.md)「Tauri 打包加速约定」）。

**身份与数据目录**（由 `FREEANIMA_BUILD_CHANNEL` 派生；未设 ⇒ `dev`）：

| Channel          | Bundle id                  | productName     | Windows 默认安装目录           | 壳默认 home    |
| ---------------- | -------------------------- | --------------- | ------------------------------ | -------------- |
| canary / release | `com.freeanima.portal`     | `FreeAnima`     | `%LOCALAPPDATA%\FreeAnima`     | `~/.anima`     |
| dev              | `com.freeanima.portal.dev` | `FreeAnima Dev` | `%LOCALAPPDATA%\FreeAnima Dev` | `~/.anima-dev` |

NSIS 安装目录 = `productName`（无独立 installDir）。`just pack tauri-windows` 按当前 `productName` 选取 setup，并在构建前清除同目录旧 `*-setup.exe`，避免误拷 `FreeAnima_*.exe` 到 `dist/`。请安装与 channel 对应的 setup（dev 安装器文件名含 `FreeAnima Dev` / `FreeAnima-Dev`）。

打包/开发脚本经 `scripts/apply-tauri-shell-identity.ts` 写出 `--config` 合并层（含 `version`；Android 另写 `bundle.android.versionCode`，公式见 `android-version-code.ts`）；`FREEANIMA_BUILD_VERSION` 同时写入 `native-build-meta`（关于页 / 更新比较）。`FREEANIMA_HOME` 仍可覆盖壳 home。Habitat/CLI 数据目录不受此表影响（仍 `~/.anima` 或 `FREEANIMA_HOME`）。

## 强制策略

1. **产品逻辑 TypeScript-only**（Habitat / features）；壳主进程 **Rust only** — 不在壳内跑 Node/Bun 业务进程。
2. **禁止 Node sidecar**：companion `remote_tools.attach` 在 **伴侣浮层**（`embedded-overlay` WebView）；壳只提供窗 / IPC / FS / 通知。
3. **`ShellApi` 注入**：`isTauri: true`、`isNativeShell: true`；桌面 `primaryInput: "pointer"`；移动 `primaryInput: "touch"`。
4. **禁止**用 `getShellKind() === "tauri"` 锁布局（三维度规则 → [`ui-dimensions.md`](ui-dimensions.md)）。
5. 编译期壳目标：`FREEANIMA_SHELL_TARGET=desktop|mobile` → `dist-desktop` / `dist-mobile`；打包前 `scripts/prepare-tauri-ui.ts` 拷入 `src-tauri/ui/web`。
6. Habitat URL + token 存壳 prefs（Rust `desktop-shell.json` / Tauri store）。
7. **原生 HTTP TLS 须用 OS 信任库**：`reqwest` 使用 `rustls-tls-native-roots`（读系统/用户 CA，含 mkcert `-install`）。**禁止**仅 `rustls-tls` / webpki-roots——否则壳「测试连接」对已装 mkcert 的 HTTPS 仍失败，而浏览器/WebView 正常（Electron 时代曾合并 system CA，同级约束）。

## Companion（桌面）

- 主窗：app-ui（Chat / Settings）。
- overlay：**工作区全屏**透明 always-on-top；**全屏 WebGL**；角色以窗内屏坐标放置（footprint 160×260 用于站立尺度/巡逻边距）；局部 click-through（角色 mesh / 气泡）；巡逻/拖拽移动角色屏坐标而非 OS 窗。
- overlay SPA 打入 `frontendDist` 的 `ui/companion/`，打包态用 `WebviewUrl::App`（与主窗同协议）；**禁止** `file://` 加载 resources（Windows 空窗 / IPC 失败）。
- Dev：`COMPANION_OVERLAY_URL` → Vite `:4176`（`just dev tauri`）。
- overlay 自持 Habitat RPC + `remote_tools.attach`；**无** localhost Node HTTP host。
- 关显示 = **close** WebView → attach 拆除（伴侣离线）。

## Coding 前哨窗（桌面）

- 独立有边框应用窗（label `coding`）；SPA 在 `frontendDist` 的 `ui/coding/`；`app_id: coding` + `remote_tools.attach`。
- UI：**Agent Window** 模式（多 Agent 会话、可无工作区 / 多根；文件预览 Shiki + 行号）。见 [`docs/modules/coding.md`](../../docs/modules/coding.md)。
- Dev：`CODING_WINDOW_URL`（Vite `:4186`）；打包 `WebviewUrl::App("coding/index.html")`。
- **Dev 远程 Vite 须 IPC**：`capabilities/default.json` 的 `remote.urls` 须包含 `http://127.0.0.1:4186/*`（及 companion `:4176`、主窗 `:5000`），且 `build.rs` AppManifest + capability 须列出对应 `allow-*`（否则 Vite 页 `invoke` 报 `not allowed. Plugin not found`）。改 capability / build.rs 后需**重启** `just dev tauri`。
- **Keep-alive**：关 UI 优先 **hide 不 close**，以保持 Outpost attach；勿照搬 Companion close=离线。主窗关闭不销毁 Coding 窗。
- 壳提供薄 FS / spawn IPC（workspace 沙箱在 TS）；**禁止** Node sidecar。

## 移动与小组件

- Android：通知、prefs、APK 覆盖更新（Rust 侧逐步补齐）。
- 主屏小组件 MVP：番茄钟（`pomodoro-active` + `set_pomodoro_widget_state`）。
- **应用图标未读角标**：桌面经 `ShellApi.setAppBadgeCount`（macOS/Linux `set_badge_count`；Windows `set_overlay_icon` 用**专用红点徽章**，禁止套用应用图标）+ `requestAppAttention`（任务栏 flash + 托盘图标闪烁）；Web 走 Badging API。**Android launcher badge 无成熟 Tauri 插件**（ShortcutBadger 需自研 Kotlin）— follow-up；移动端仅尽力 `navigator.setAppBadge`。
- **Windows Toast**：启动时注册 bundle `identifier` 为 AppUserModelID（HKCU + `SetCurrentProcessExplicitAppUserModelID`），否则安装态通知会被 WinRT 静默丢弃。

## 禁止

- 为迁壳重写 Habitat / 产品 features。
- 把 Android AppWidget 与桌面 companion overlay 做成同一套 UI 抽象。
- 重新引入 Electron / Capacitor 双轨工程。
