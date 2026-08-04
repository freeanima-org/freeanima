#!/usr/bin/env bun
/**
 * `just pack tauri-windows` 统一入口：
 * - Windows 宿主 → 本机 MSVC 打包（build-tauri-desktop.ts）
 * - Linux/macOS → 交叉编译 NSIS（build-tauri-desktop-windows.ts）
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(script: string): void {
  const r = spawnSync("bun", [script], { cwd: root, stdio: "inherit" });
  process.exit(r.status ?? 1);
}

function main(): void {
  if (process.platform === "win32") {
    console.log("[pack tauri-windows] Windows 宿主 → 本机 MSVC 打包（非交叉编译）");
    const ensure = spawnSync("bun", ["scripts/ensure-tauri-desktop-native.ts", "--check"], {
      cwd: root,
      stdio: "inherit",
    });
    if (ensure.status !== 0) process.exit(ensure.status ?? 1);
    run("scripts/build-tauri-desktop.ts");
    return;
  }
  console.log("[pack tauri-windows] 非 Windows 宿主 → 交叉编译 NSIS");
  run("scripts/build-tauri-desktop-windows.ts");
}

if (import.meta.main) main();
