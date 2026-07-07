# FreeAnima 移动端（Android）

Capacitor **bootstrap 薄壳** + Hub `/web/*` 远程 UI。Hub 地址在 bootstrap 或 APP 内设置页配置。

## 前置条件

- [Bun](https://bun.sh)（与仓库根 package 一致）
- JDK 17+（本机已装 OpenJDK 21）
- Android SDK（首次可运行 `bash scripts/setup-android-sdk.sh`，默认装到 `~/Android/Sdk`）
- PC 上运行 Anima Service，并允许局域网访问：

```bash
anima service start --host 0.0.0.0
```

默认仅绑定 `127.0.0.1` 时，手机无法连接。

## 构建

本目录的 `package.json` 为 **Capacitor CLI 必需 stub**（`cap sync` 要求 cwd 下有 package.json），不是独立 npm 包；Capacitor 依赖仍由仓库根 `package.json` 提供。

```bash
# 从仓库根目录
bun run build:mobile
cd src/app/shell/mobile && bunx cap sync android

# Debug 构建（bootstrap 不压缩 + sourcemap）
bun run build:mobile:debug
```

## 安装到真机（sideload）

```bash
cd src/app/shell/mobile

# 仅构建 APK
bash scripts/build-apk.sh

# 或一步：构建 + sync + Gradle + 安装 + 启动
bash scripts/run-android.sh
```

从仓库根目录也可：`bun run debug:android`（remote UI + debug bootstrap）。  
**注意**：Gradle 编译阶段可能持续数分钟；调试时推荐在本目录直接 `bash scripts/run-android.sh`（可看到 `--console=plain` 流式日志），或分步 `build-apk.sh` + `install-apk.sh`。

脚本会自动 `source scripts/android-env.sh`（`ANDROID_HOME=~/Android/Sdk`）。  
`~/.bashrc.local` 也已写入 SDK 环境变量，新开终端可直接用 `adb`。

Debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`

## 使用

1. 首次启动进入 **Hub 设置**，填写 PC 局域网地址，如 `http://192.168.1.10:2658`，以及 Service API Token
2. **测试连接** → **保存并进入** → 跳转 Hub `/web/chat`
3. 底栏切换 **Chat / Tasks / Email / Notifications**；**More** 进入管理台与设置
4. **设置 → 调试**：配置 Sentry DSN、移动 vConsole、查看 DevTools 说明

UI 随 Hub `build:web` / `anima upgrade` 更新；`chrome://inspect` 调试 Hub 页面。

## 架构

| 路径                  | 作用                                        |
| --------------------- | ------------------------------------------- |
| `package.json`        | Capacitor CLI stub（非 workspace 包）       |
| `bootstrap/`          | Hub 配置表单 + 跳转 Hub `/web/chat`         |
| `lib/mobile-shell.ts` | Preferences 持久化、`window.satelliteShell` |
| `lib/debug-events.ts` | debug 设置变更事件常量                      |
| `vite.config.ts`      | 构建 bootstrap → `www/`                     |
| `www/`                | bootstrap 静态资源（非完整 SPA）            |
| `android/`            | Capacitor Android 工程                      |

Hub SPA 侧 [`bootstrap-capacitor.ts`](../web/lib/bridge/bootstrap-capacitor.ts) 注入 Capacitor 原生能力。

详见 [`docs/features/mobile-app.md`](../../../docs/features/mobile-app.md)。
