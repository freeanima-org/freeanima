# just pack …
# 产物：web / cli / tauri（本机）/ tauri-windows（Win 本机或交叉）/ tauri-android
# 部件：tauri-ui / app-ui / brand-icons
import '_common.just'

[private]
[no-cd]
_ensure-tauri-desktop:
  {{ bun }} scripts/ensure-tauri-desktop-native.ts --check

[private]
[no-cd]
_ensure-tauri-linux:
  {{ bun }} scripts/ensure-tauri-desktop-native.ts --check --require linux

[private]
[no-cd]
_ensure-android:
  {{ bun }} scripts/install-android-deps.ts --check

[private]
[no-cd]
_ensure-tauri-android: _ensure-android
  {{ bun }} scripts/install-android-tauri-deps.ts --check

# ─── 产物 ───────────────────────────────────────────

# Web UI dist（vite）
[no-cd]
web: _deps
  {{ bun }} scripts/build-web.ts

# Linux standalone 可执行文件
[no-cd]
cli: _deps
  {{ bun }} scripts/build-cli-executable.ts

# 当前宿主平台桌面壳（Win→NSIS / Linux→AppImage；与 just dev tauri 同工具链）
# 环境：FREEANIMA_BUILD_CHANNEL（缺省 local）
[no-cd]
tauri: _deps _ensure-tauri-desktop
  {{ bun }} scripts/build-tauri-desktop.ts

# Linux 本机 AppImage（非 Linux 宿主请用 just pack tauri）
[no-cd]
tauri-linux: _deps _ensure-tauri-linux
  {{ bun }} scripts/build-tauri-desktop.ts

# Windows NSIS：Windows 上本机 MSVC；Linux/macOS 上交叉编译（cargo-xwin）
[no-cd]
tauri-windows: _deps
  {{ bun }} scripts/pack-tauri-windows.ts

# Tauri Android APK → dist/freeanima-mobile-tauri-android.apk
[no-cd]
tauri-android: _deps _ensure-tauri-android
  {{ bun }} scripts/build-tauri-android.ts

# ─── 部件 / CI ──────────────────────────────────────

# Tauri frontendDist 准备（desktop|mobile）；脚本 prepare-tauri-ui.ts
[no-cd]
tauri-ui target="desktop": _deps
  {{ bun }} scripts/prepare-tauri-ui.ts {{target}}

# app-ui 独立构建（CI）
[no-cd]
app-ui: _deps
  {{ bun }} src/client/app-frame/build.ts

# 品牌图标
[no-cd]
brand-icons: _deps
  {{ bun }} scripts/generate-brand-icons.ts

# Vault 浏览器扩展 Chrome MV3（→ dist/browser-extension + zip）
# 环境：FREEANIMA_BUILD_CHANNEL（缺省 local）；CI 设 canary|release + FREEANIMA_BUILD_VERSION
[no-cd]
browser-extension-chrome: _deps
  {{ bun }} scripts/build-browser-extension-chrome.ts

# Vault 浏览器扩展 Firefox（→ 签名/未签名 xpi + updates.json；跟 canary 自托管）
# 签名：FREEANIMA_AMO_API_KEY + FREEANIMA_AMO_API_SECRET（缺省则未签名，仅调试）
[no-cd]
browser-extension-firefox: _deps
  {{ bun }} scripts/build-browser-extension-firefox.ts
