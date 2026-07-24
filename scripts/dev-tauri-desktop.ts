#!/usr/bin/env bun
/**
 * 开发：可选起 companion static，再 tauri dev。
 * 需：已 bun install、Rust、系统 WebView；主窗默认连 Vite :5000（先 just dev web）。
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/app/shell/tauri");

process.env.COMPANION_OVERLAY_URL ??= "http://127.0.0.1:4176/?view=overlay";

const identity = applyTauriShellIdentity({ target: "desktop" });
process.env.FREEANIMA_BUILD_CHANNEL ??= identity.channel;

const companion = spawn("bun", ["src/features/companion/dev.ts"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const tauri = spawn("bunx", ["tauri", "dev", "--config", identity.configArg], {
  cwd: tauriDir,
  stdio: "inherit",
  env: process.env,
  shell: true,
});

function shutdown() {
  companion.kill("SIGTERM");
  tauri.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

tauri.on("exit", (code) => {
  companion.kill("SIGTERM");
  process.exit(code ?? 0);
});
