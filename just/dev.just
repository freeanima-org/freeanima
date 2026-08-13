# just dev …
import '_common.just'

# Habitat ≥10000 / Web :5000；见 scripts/dev.ts。可选 HABITAT_PORT / WEB_DEV_PORT。
# Habitat 默认 debounce 硬重启（scripts/dev-habitat-watch.ts）；FREEANIMA_HABITAT_WATCH=0 可关。
# `just dev` → 本 default；`just dev habitat` / `just dev web` 等为子命令。
[no-cd]
default: _deps
  {{ bun }} scripts/dev.ts

# 仅 Habitat（可附加：just dev habitat -- --port 12001）
[no-cd]
habitat *args: _deps
  {{ bun }} scripts/dev-habitat-watch.ts {{args}}

# 仅 Vite Web
[no-cd]
web *args: _deps
  {{ bun }} scripts/dev-web.ts {{args}}

# Tauri 桌面壳（Win/Linux/mac 同命令；需 just dev / just dev web，Vite :5000）
# Windows 需 MSVC：just install tauri；或先 vcvars64.bat
[no-cd]
tauri: _deps
  {{ bun }} scripts/ensure-tauri-desktop-native.ts --check
  {{ bun }} scripts/dev-tauri-desktop.ts

# Android Tauri 调试
[no-cd]
tauri-android: _deps
  {{ bun }} scripts/dev-tauri-mobile.ts

# Vault 浏览器扩展 Chrome（WXT；加载 .output/chrome-mv3）
[no-cd]
browser-extension-chrome *args: _deps
  {{ bun }} x wxt {{args}}

# Vault 浏览器扩展 Firefox（WXT -b firefox --mv3）
[no-cd]
browser-extension-firefox *args: _deps
  {{ bun }} x wxt -b firefox --mv3 {{args}}
