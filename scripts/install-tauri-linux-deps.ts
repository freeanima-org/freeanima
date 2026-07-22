#!/usr/bin/env bun
/**
 * 安装 / 校验本机 `just pack-tauri`（Linux）WebKitGTK 开发库。
 *
 *   bun scripts/install-tauri-linux-deps.ts
 *   bun scripts/install-tauri-linux-deps.ts --apt
 *   bun scripts/install-tauri-linux-deps.ts --check
 */
import { spawnSync } from "node:child_process";

const withApt = process.argv.includes("--apt");
const checkOnly = process.argv.includes("--check");
const HINT = "just install-tauri-linux -- --apt";

const PKGS = [
  "libwebkit2gtk-4.1-dev",
  "libjavascriptcoregtk-4.1-dev",
  "libsoup-3.0-dev",
  "libappindicator3-dev",
  "librsvg2-dev",
  "patchelf",
];

function webkitOk(): boolean {
  return (
    spawnSync("pkg-config", ["--exists", "javascriptcoregtk-4.1", "webkit2gtk-4.1"], {
      stdio: "ignore",
    }).status === 0
  );
}

function run(cmd: string, args: string[], label: string): void {
  console.log(`[install-tauri-linux] ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`[install-tauri-linux] 失败：${label}`);
    process.exit(r.status ?? 1);
  }
}

if (process.platform !== "linux") {
  console.log("[install-tauri-linux] 非 Linux，跳过");
  process.exit(0);
}

if (webkitOk()) {
  console.log(checkOnly ? "[ensure-tauri-linux] OK" : "[install-tauri-linux] WebKitGTK 已就绪");
  process.exit(0);
}

if (checkOnly) {
  console.error(`[ensure-tauri-linux] 缺少 WebKitGTK 开发库\n请先：\n  ${HINT}`);
  process.exit(1);
}

console.log(`[install-tauri-linux] 缺少包：${PKGS.join(" ")}`);
if (withApt) {
  run("sudo", ["apt-get", "update", "-qq"], "sudo apt-get update");
  run("sudo", ["apt-get", "install", "-y", ...PKGS], `sudo apt-get install -y ${PKGS.join(" ")}`);
  console.log("[install-tauri-linux] 完成。下一步：just pack-tauri");
  process.exit(0);
}

console.error(
  "[install-tauri-linux] 请安装：\n" +
    `  sudo apt-get install -y ${PKGS.join(" ")}\n` +
    `或：${HINT}`,
);
process.exit(1);
