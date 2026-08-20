# just install …（系统依赖 + CLI / APK）
import '_common.just'

# 当前宿主：桌面壳本机依赖（Linux WebKit / Windows MSVC 提示 / macOS Xcode）
[no-cd]
tauri *args:
  {{ bun }} scripts/install-tauri-desktop-native.ts {{args}}

# 本机 Linux pack：WebKitGTK（缺包：just install tauri -- --apt 或 just install tauri-linux -- --apt）
[no-cd]
tauri-linux *args:
  {{ bun }} scripts/install-tauri-linux-deps.ts {{args}}

# Windows：本机打印 MSVC 安装提示；非 Windows：交叉编译工具链（rust target + cargo-xwin）
[no-cd]
tauri-windows *args: _deps
  {{ bun }} scripts/install-tauri-windows-dispatch.ts {{args}}

# Android SDK + JDK
[no-cd]
android *args: _deps
  {{ bun }} scripts/install-android-deps.ts {{args}}

# Tauri Android：Rust targets + NDK + gen（缺工程：--init；全 ABI：--all-targets）
[no-cd]
tauri-android *args: _deps
  {{ bun }} scripts/install-android-tauri-deps.ts {{args}}

# 构建后安装到独立前缀（默认 ~/.anima/standalone）
[no-cd]
cli: _deps
  {{ bun }} scripts/build-cli-executable.ts
  {{ bun }} scripts/install-cli.ts --skip-build

# 仅重装已有 dist（跳过 build）
[no-cd]
cli-from-dist: _deps
  {{ bun }} scripts/install-cli.ts --skip-build

# 仅安装已有 dist APK（无设备则跳过）：just install tauri-android-apk
[no-cd]
tauri-android-apk: _deps
  {{ bun }} scripts/try-adb-install-apk.ts dist/freeanima-mobile-tauri-android.apk
