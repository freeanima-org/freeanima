#!/usr/bin/env bun
/**
 * 安装 / 校验 Android SDK + JDK（Tauri Android 打包）。
 *
 *   bun scripts/install-android-deps.ts
 *   bun scripts/install-android-deps.ts --apt   # 顺带装 openjdk-21-jdk
 *   bun scripts/install-android-deps.ts --check
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const withApt = process.argv.includes("--apt");
const checkOnly = process.argv.includes("--check");
const HINT = "just install-android\n  # 或缺 JDK：just install-android -- --apt";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const setupSdk = join(root, "scripts/setup-android-sdk.sh");
const androidEnv = join(root, "scripts/android-env.sh");

function which(cmd: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

function sdkHome(): string {
  if (process.env.GITHUB_ACTIONS) return join(process.env.HOME ?? "", "Android/Sdk");
  return process.env.ANDROID_HOME?.trim() || join(process.env.HOME ?? "", "Android/Sdk");
}

function javaOk(): boolean {
  return which("java");
}

function sdkOk(): boolean {
  const sdk = sdkHome();
  return (
    existsSync(join(sdk, "platform-tools/adb")) ||
    existsSync(join(sdk, "cmdline-tools/latest/bin/sdkmanager"))
  );
}

function listMissing(): string[] {
  const missing: string[] = [];
  if (!javaOk()) missing.push("JDK 17+ (java)");
  if (!sdkOk()) missing.push(`Android SDK (${sdkHome()})`);
  else if (!which("adb") && !existsSync(join(sdkHome(), "platform-tools/adb"))) {
    missing.push("adb / platform-tools");
  }
  return missing;
}

function run(cmd: string, args: string[], label: string): void {
  console.log(`[install-android] ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: false });
  if (r.status !== 0) {
    console.error(`[install-android] 失败：${label}`);
    process.exit(r.status ?? 1);
  }
}

if (checkOnly) {
  const missing = listMissing();
  if (missing.length > 0) {
    console.error(`[ensure-android] 依赖不完整：${missing.join(", ")}\n请先：\n  ${HINT}`);
    process.exit(1);
  }
  console.log("[ensure-android] OK");
  process.exit(0);
}

console.log("[install-android] 开始安装 Android 打包依赖…");

if (!javaOk()) {
  if (process.platform === "linux" && withApt) {
    run("sudo", ["apt-get", "update", "-qq"], "sudo apt-get update");
    run(
      "sudo",
      ["apt-get", "install", "-y", "openjdk-21-jdk", "wget", "unzip"],
      "sudo apt-get install -y openjdk-21-jdk wget unzip",
    );
  } else {
    console.error(
      "[install-android] 未找到 java。Debian：\n" +
        "  sudo apt-get install -y openjdk-21-jdk\n" +
        "或：just install-android -- --apt",
    );
    process.exit(1);
  }
}

if (!existsSync(setupSdk)) {
  console.error(`[install-android] 缺少 ${setupSdk}`);
  process.exit(1);
}

run("bash", [setupSdk], "setup-android-sdk.sh");

const probe = spawnSync(
  "bash",
  ["-c", `source "${androidEnv}" && command -v adb && adb version | head -1`],
  { encoding: "utf-8", env: process.env },
);
if (probe.status !== 0) {
  console.error("[install-android] SDK 安装后仍找不到 adb");
  process.exit(1);
}
console.log(`[install-android] ${probe.stdout?.trim()}`);
console.log("[install-android] 完成。下一步：just install-android-tauri && just pack-android");
process.exit(0);
