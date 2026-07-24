# just pack …
import '_common.just'

[private]
[no-cd]
_ensure-tauri-linux:
  bun scripts/install-tauri-linux-deps.ts --check

[private]
[no-cd]
_ensure-tauri-windows:
  bun scripts/install-tauri-windows-toolchain.ts --check

[private]
[no-cd]
_ensure-android:
  bun scripts/install-android-deps.ts --check

[private]
[no-cd]
_ensure-android-tauri: _ensure-android
  bun scripts/install-android-tauri-deps.ts --check

# Web UI dist（paraglide + vite）
[no-cd]
web: _deps
  bun scripts/build-web.ts

# Linux standalone 可执行文件
[no-cd]
cli: _deps
  bun scripts/build-cli-executable.ts

# shell-ui 独立构建（CI）
[no-cd]
shell-ui: _deps
  bun src/frontend/shell-ui/build.ts

# Tauri UI 准备（desktop|mobile）
[no-cd]
prepare-ui target="desktop": _deps
  bun scripts/prepare-tauri-ui.ts {{target}}

# 品牌图标
[no-cd]
brand-icons: _deps
  bun scripts/generate-brand-icons.ts

# Tauri 本机安装包（Linux 需 WebKitGTK）
[no-cd]
tauri: _deps _ensure-tauri-linux
  bun scripts/build-tauri-desktop.ts

# Tauri Windows NSIS 交叉编译
[no-cd]
tauri-windows: _deps _ensure-tauri-windows
  bun scripts/build-tauri-desktop-windows.ts

# Tauri Android APK → dist/freeanima-mobile-tauri-android.apk
[no-cd]
android: _deps _ensure-android-tauri
  bun scripts/build-tauri-android.ts
