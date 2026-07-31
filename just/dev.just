# just dev …
import '_common.just'

# Habitat ≥10000 / Web :5000；见 scripts/dev.ts。可选 HABITAT_PORT / WEB_DEV_PORT。
# `just dev` → 本 default；`just dev habitat` / `just dev web` 等为子命令。
[no-cd]
default: _deps
  bun scripts/dev.ts

# 仅 Habitat（可附加：just dev habitat -- --port 12001）
[no-cd]
habitat *args: _deps
  bun src/portal/cli/dev-habitat.ts {{args}}

# 仅 Vite Web
[no-cd]
web *args: _deps
  bun scripts/dev-web.ts {{args}}

# Tauri 桌面壳（需 just dev web 或已有 Vite :5000）
[no-cd]
tauri: _deps
  bun scripts/dev-tauri-desktop.ts

# Android Tauri 调试
[no-cd]
tauri-android: _deps
  bun scripts/dev-tauri-mobile.ts

# Vault 浏览器扩展（WXT；Chrome 加载 .output/chrome-mv3）
[no-cd]
browser-extension *args: _deps
  bunx wxt {{args}}
