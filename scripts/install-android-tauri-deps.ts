#!/usr/bin/env bun
/**
 * 安装 / 校验 Tauri Android 额外依赖（Rust Android targets、NDK、android gen）。
 * 需先具备 Android SDK（just install android）。
 *
 *   bun scripts/install-android-tauri-deps.ts
 *   bun scripts/install-android-tauri-deps.ts --init   # 缺失时执行 tauri android init
 *   bun scripts/install-android-tauri-deps.ts --check
 *   bun scripts/install-android-tauri-deps.ts --all-targets  # 安装四 ABI rustup targets
 *
 * 默认只装 `FREEANIMA_ANDROID_TARGETS`（缺省 aarch64）对应 targets。
 */
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANDROID_NDK_PACKAGE,
  resolveAndroidPackAbis,
  rustTargetsForAbis,
} from "./android-pack-targets.ts";

const checkOnly = process.argv.includes("--check");
const doInit = process.argv.includes("--init");
const HINT = "just install tauri-android\n  # 缺工程：just install tauri-android -- --init";

/** 安装/校验所需 rustup targets（默认 aarch64；`--all-targets` 或 FREEANIMA_ANDROID_TARGETS=all） */
const ANDROID_TARGETS = process.argv.includes("--all-targets")
  ? rustTargetsForAbis(resolveAndroidPackAbis({ FREEANIMA_ANDROID_TARGETS: "all" }))
  : rustTargetsForAbis(resolveAndroidPackAbis());

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "packages/frontend/portal/app/tauri");
const androidGen = join(tauriDir, "src-tauri/gen/android");

function which(cmd: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

function sdkHome(): string {
  if (process.env.GITHUB_ACTIONS) return join(process.env.HOME ?? "", "Android/Sdk");
  return process.env.ANDROID_HOME?.trim() || join(process.env.HOME ?? "", "Android/Sdk");
}

function installedRustTargets(): string {
  return (
    spawnSync("rustup", ["target", "list", "--installed"], {
      encoding: "utf-8",
      shell: false,
    }).stdout ?? ""
  );
}

function ndkPresent(): boolean {
  const ndkRoot = join(sdkHome(), "ndk");
  if (!existsSync(ndkRoot)) return false;
  try {
    return readdirSync(ndkRoot).length > 0;
  } catch {
    return false;
  }
}

function listMissing(): string[] {
  const missing: string[] = [];
  if (!which("rustup")) missing.push("rustup");
  else {
    const installed = installedRustTargets();
    for (const t of ANDROID_TARGETS) {
      if (!installed.includes(t)) missing.push(`rust target ${t}`);
    }
  }
  if (!ndkPresent()) missing.push("Android NDK");
  if (!existsSync(androidGen)) missing.push("tauri android gen（需 tauri android init）");
  return missing;
}

function run(cmd: string, args: string[], label: string, cwd?: string): void {
  console.log(`[install-android-tauri] ${label}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
    cwd,
  });
  if (r.status !== 0) {
    console.error(`[install-android-tauri] 失败：${label}`);
    process.exit(r.status ?? 1);
  }
}

if (checkOnly) {
  const missing = listMissing();
  if (missing.length > 0) {
    console.error(`[ensure-android-tauri] 依赖不完整：${missing.join(", ")}\n请先：\n  ${HINT}`);
    process.exit(1);
  }
  console.log("[ensure-android-tauri] OK");
  process.exit(0);
}

console.log("[install-android-tauri] 开始安装 Tauri Android 依赖…");

if (!which("rustup")) {
  console.error("[install-android-tauri] 未找到 rustup");
  process.exit(1);
}

{
  const installed = installedRustTargets();
  const need = ANDROID_TARGETS.filter((t) => !installed.includes(t));
  if (need.length === 0) {
    console.log("[install-android-tauri] Rust Android targets 已安装");
  } else {
    run("rustup", ["target", "add", ...need], `rustup target add ${need.join(" ")}`);
  }
}

if (!ndkPresent()) {
  const sdkmanager = join(sdkHome(), "cmdline-tools/latest/bin/sdkmanager");
  if (!existsSync(sdkmanager)) {
    console.error("[install-android-tauri] 未找到 sdkmanager。请先：just install android");
    process.exit(1);
  }
  // 版本与 scripts/setup-android-sdk.sh / cache-android-sdk key 对齐
  run(
    "bash",
    [
      "-c",
      `yes | "${sdkmanager}" --licenses >/dev/null 2>&1 || true; "${sdkmanager}" "${ANDROID_NDK_PACKAGE}" || "${sdkmanager}" ndk`,
    ],
    `sdkmanager install ${ANDROID_NDK_PACKAGE}`,
  );
} else {
  console.log("[install-android-tauri] Android NDK 已就绪");
}

if (!existsSync(androidGen)) {
  if (doInit) {
    run("bun", ["x", "tauri", "android", "init"], "tauri android init", tauriDir);
  } else {
    console.error(
      "[install-android-tauri] 尚未生成 Android 工程。请执行：\n" +
        "  just install tauri-android -- --init\n" +
        "或：\n" +
        "  cd packages/frontend/portal/app/tauri && bun x tauri android init",
    );
    process.exit(1);
  }
} else {
  console.log("[install-android-tauri] gen/android 已存在");
}

run("bun", ["scripts/patch-tauri-android.ts"], "patch-tauri-android", root);
run("bun", ["scripts/generate-brand-icons.ts"], "brand-icons", root);

console.log("[install-android-tauri] 完成。下一步：just pack tauri-android");
process.exit(0);
