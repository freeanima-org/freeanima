# FreeAnima 移动端（Android）

Capacitor 壳 + 聊天室 / 管理台 bundled SPA。Hub 地址在 APP 内 UI 配置。

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

```bash
# 从仓库根目录
bun run build:mobile
cd src/app/shell/mobile && bunx cap sync android

# Debug 构建（不压缩 + sourcemap，便于 Chrome inspect）
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

从仓库根目录也可：`bun run debug:android`（bundled UI + debug 构建）。  
**注意**：Gradle 编译阶段可能持续数分钟；调试时推荐在本目录直接 `bash scripts/run-android.sh`（可看到 `--console=plain` 流式日志），或分步 `build-apk.sh` + `install-apk.sh`。

脚本会自动 `source scripts/android-env.sh`（`ANDROID_HOME=~/Android/Sdk`）。  
`~/.bashrc.local` 也已写入 SDK 环境变量，新开终端可直接用 `adb`。

Debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`

## 使用

1. 首次启动进入 **Hub 设置**，填写 PC 局域网地址，如 `http://192.168.1.10:2658`，以及 Hub `remote_auth.token`
2. **测试连接** → **保存并进入**
3. 底栏切换 **Chat / Tasks / Email / Notifications**；**More** 进入管理台与设置
4. **设置 → 调试**：配置 Sentry DSN、移动 vConsole、查看 DevTools 说明

## 架构

| 路径                  | 作用                                        |
| --------------------- | ------------------------------------------- |
| `lib/mobile-shell.ts` | Preferences 持久化、`window.satelliteShell` |
| `spa/shell-bridge.ts` | 启动时注入壳层 API，阻塞 SPA 直至 Hub 就绪  |
| `vite.config.ts`      | 构建 shell-ui → `www/` + shell-bridge       |
| `www/`                | 统一 SPA（`/chat`、`/admin`、`/settings`）  |
| `android/`            | Capacitor Android 工程                      |

详见 [`docs/features/mobile-app.md`](../../../docs/features/mobile-app.md)。
