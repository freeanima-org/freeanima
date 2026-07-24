# just install …（系统依赖 + CLI / APK）
import '_common.just'

# 本机 Linux pack tauri-linux：WebKitGTK（缺包：just install tauri-linux -- --apt）
[no-cd]
tauri-linux *args:
  bun scripts/install-tauri-linux-deps.ts {{args}}

# 交叉 pack tauri-windows：rust target + cargo-xwin
[no-cd]
tauri-windows *args: _deps
  bun scripts/install-tauri-windows-toolchain.ts {{args}}

# Android SDK + JDK
[no-cd]
android *args: _deps
  bun scripts/install-android-deps.ts {{args}}

# Tauri Android：Rust targets + NDK + gen（缺工程：--init）
[no-cd]
tauri-android *args: _deps
  bun scripts/install-android-tauri-deps.ts {{args}}

# 构建后安装到独立前缀（默认 ~/.anima/standalone）
[no-cd]
cli: _deps
  bun scripts/build-cli-executable.ts
  bun scripts/install-cli.ts --skip-build

# 仅重装已有 dist（跳过 build）
[no-cd]
cli-from-dist: _deps
  bun scripts/install-cli.ts --skip-build

# 仅安装已有 dist APK（无设备则跳过）：just install tauri-android-apk
[no-cd]
tauri-android-apk: _deps
  bun scripts/try-adb-install-apk.ts dist/freeanima-mobile-tauri-android.apk
