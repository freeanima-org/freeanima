#!/usr/bin/env bun
/**
 * `just install tauri-windows`：
 * - Windows → 与 `just install tauri` 相同（MSVC 检查 / winget 提示）
 * - 其它 → 交叉编译工具链 install-tauri-windows-toolchain.ts
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const passthrough = process.argv.slice(2);

if (process.platform === "win32") {
  console.log("[install tauri-windows] Windows 宿主 → 本机 MSVC（同 just install tauri）");
  const r = spawnSync("bun", ["scripts/install-tauri-desktop-native.ts", ...passthrough], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

const r = spawnSync("bun", ["scripts/install-tauri-windows-toolchain.ts", ...passthrough], {
  cwd: root,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
