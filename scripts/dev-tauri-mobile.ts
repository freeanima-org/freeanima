#!/usr/bin/env bun
/**
 * Tauri Android 开发入口（需已 `tauri android init` 生成工程）。
 * 当前仓库含 src-tauri 骨架 + 小组件占位；首次在本机执行：
 *   cd src/app/shell/tauri && bunx tauri android init
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/app/shell/tauri");
const androidDir = join(tauriDir, "src-tauri/gen/android");

if (!existsSync(androidDir)) {
  console.error(
    "[dev-tauri-mobile] 尚未生成 Android 工程。请先：\n" +
      "  cd src/app/shell/tauri && bunx tauri android init\n" +
      "并安装 Rust Android targets / Android SDK。",
  );
  process.exit(1);
}

const r = spawnSync("bunx", ["tauri", "android", "dev"], {
  cwd: tauriDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
