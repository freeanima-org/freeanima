# FreeAnima 移动端（Android）

Capacitor 壳 + 聊天室 / 管理台 bundled SPA。Hub 地址在 APP 内 UI 配置。

## 前置条件

- [Bun](https://bun.sh)（与 monorepo 一致）
- JDK 17+（本机已装 OpenJDK 21）
- Android SDK（首次可运行 `bun run setup:sdk`，默认装到 `~/Android/Sdk`）
- PC 上运行 Anima Service，并允许局域网访问：

```bash
anima service start --host 0.0.0.0
```

默认仅绑定 `127.0.0.1` 时，手机无法连接。

## 构建

```bash
# 从仓库根目录
bun run --filter @freeanima/app-mobile build

# 或在本目录
bun run build
bun run sync          # 复制 www 并 sync 到 android/

# Debug 构建（不压缩 + sourcemap，便于 Chrome inspect）
bun run build:debug
bun run android:debug # 构建 + 安装 + 启动
```

## 安装到真机（sideload）

```bash
cd app/mobile

# 构建 APK 并安装（手机 USB 调试已开、adb devices 可见 device）
bun run android:apk
bun run android:install

# 或一步：构建 www + sync + Gradle 编译 + 安装 + 启动
bun run android
```

从仓库根目录也可：`bun run app/mobile:android`（经 Bun filter 包装）。  
**注意**：Gradle 编译阶段可能持续数分钟；经 filter 运行时 sync 之后可能长时间无新输出，属正常现象。调试时推荐在本目录直接 `bun run android`（可看到 `--console=plain` 流式日志），或分步 `android:apk` + `android:install`。

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
| `src/mobile-shell.ts` | Preferences 持久化、`window.satelliteShell` |
| `src/shell-bridge.ts` | 启动时注入壳层 API，阻塞 SPA 直至 Hub 就绪  |
| `build.ts`            | 构建 shell-ui → `www/` + shell-bridge       |
| `www/`                | 统一 SPA（`/chat`、`/admin`、`/settings`）  |
| `android/`            | Capacitor Android 工程                      |

详见 [`docs/features/mobile-app.md`](../../docs/features/mobile-app.md)。
