# just pack …
# 产物：web / cli / tauri-linux|windows|android
# 部件：tauri-ui / app-ui / brand-icons
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
_ensure-tauri-android: _ensure-android
  bun scripts/install-android-tauri-deps.ts --check

# ─── 产物 ───────────────────────────────────────────

# Web UI dist（paraglide + vite）
[no-cd]
web: _deps
  bun scripts/build-web.ts

# Linux standalone 可执行文件
[no-cd]
cli: _deps
  bun scripts/build-cli-executable.ts

# Tauri 本机 Linux 安装包（需 WebKitGTK）
[no-cd]
tauri-linux: _deps _ensure-tauri-linux
  bun scripts/build-tauri-desktop.ts

# Tauri Windows NSIS 交叉编译
[no-cd]
tauri-windows: _deps _ensure-tauri-windows
  bun scripts/build-tauri-desktop-windows.ts

# Tauri Android APK → dist/freeanima-mobile-tauri-android.apk
[no-cd]
tauri-android: _deps _ensure-tauri-android
  bun scripts/build-tauri-android.ts

# ─── 部件 / CI ──────────────────────────────────────

# Tauri frontendDist 准备（desktop|mobile）；脚本 prepare-tauri-ui.ts
[no-cd]
tauri-ui target="desktop": _deps
  bun scripts/prepare-tauri-ui.ts {{target}}

# app-ui 独立构建（CI）
[no-cd]
app-ui: _deps
  bun src/frontend/app-ui/build.ts

# 品牌图标
[no-cd]
brand-icons: _deps
  bun scripts/generate-brand-icons.ts
