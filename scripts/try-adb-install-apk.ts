/**
 * 若本机有 adb 且至少一台 `device` 状态设备，则 `adb install -r` 安装 APK。
 * 无 adb / 无设备 / 安装失败均只告警，不抛错（供 pack 后「尝试安装」）。
 *
 * 环境变量：
 * - FREEANIMA_ADB_INSTALL=0 — 跳过
 * - ANDROID_HOME / ANDROID_SDK_ROOT — 解析 platform-tools/adb
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { resolveBuildChannelFromEnv } from "@freeanima/habitat/core/config/build-meta.ts";
import { resolveMobileShellIdentity } from "@freeanima/habitat/core/config/shell-identity.ts";

export type TryAdbInstallResult =
  | { status: "skipped"; reason: string }
  | { status: "installed"; deviceCount: number }
  | { status: "failed"; reason: string };

function resolveAdb(): string | null {
  const home = process.env.ANDROID_HOME?.trim() || process.env.ANDROID_SDK_ROOT?.trim();
  if (home) {
    const fromSdk = join(home, "platform-tools", "adb");
    if (existsSync(fromSdk)) return fromSdk;
  }
  const which = spawnSync("bash", ["-c", "command -v adb"], { encoding: "utf-8" });
  const path = which.stdout?.trim();
  return path || null;
}

function countAdbDevices(adb: string): number {
  const r = spawnSync(adb, ["devices"], { encoding: "utf-8" });
  if (r.status !== 0) return 0;
  const lines = (r.stdout ?? "").split("\n").slice(1);
  let n = 0;
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1] === "device") n += 1;
  }
  return n;
}

/** 打包后尝试安装；永不抛错。 */
export function tryAdbInstallApk(
  apkPath: string,
  logPrefix = "[adb-install]",
): TryAdbInstallResult {
  if (process.env.FREEANIMA_ADB_INSTALL === "0") {
    console.log(`${logPrefix} FREEANIMA_ADB_INSTALL=0，跳过`);
    return { status: "skipped", reason: "disabled" };
  }
  if (!existsSync(apkPath)) {
    console.warn(`${logPrefix} APK 不存在：${apkPath}`);
    return { status: "failed", reason: "missing-apk" };
  }

  const adb = resolveAdb();
  if (!adb) {
    console.log(`${logPrefix} 未找到 adb，跳过安装（可 just install android）`);
    return { status: "skipped", reason: "no-adb" };
  }

  const devices = countAdbDevices(adb);
  if (devices < 1) {
    console.log(`${logPrefix} 无已连接设备（adb devices），跳过安装`);
    return { status: "skipped", reason: "no-device" };
  }

  console.log(`${logPrefix} 检测到 ${devices} 台设备，安装 ${apkPath}…`);
  // -r 覆盖；-d 允许降级（设备上常有更高 versionCode 的 canary）
  const first = spawnSync(adb, ["install", "-r", "-d", apkPath], {
    encoding: "utf-8" as const,
    stdio: ["ignore", "pipe", "pipe"] as const,
  });
  const combined = `${first.stdout ?? ""}\n${first.stderr ?? ""}`;
  const needReplace =
    first.status !== 0 ||
    /INSTALL_FAILED_VERSION_DOWNGRADE|INSTALL_FAILED_UPDATE_INCOMPATIBLE|INSTALL_PARSE_FAILED_NO_CERTIFICATES/i.test(
      combined,
    );

  let exitCode = first.status;
  if (needReplace) {
    if (combined.trim()) process.stdout.write(combined);
    const channel = resolveBuildChannelFromEnv("local");
    const appId = resolveMobileShellIdentity(channel).applicationId;
    // 顺带卸旧包名（org.freeanima.app → com.freeanima.portal 迁移）
    for (const pkg of [appId, "org.freeanima.app"]) {
      console.warn(`${logPrefix} 覆盖安装失败，卸载 ${pkg} 后重装…`);
      spawnSync(adb, ["uninstall", pkg], { stdio: "inherit" });
    }
    exitCode = spawnSync(adb, ["install", apkPath], { stdio: "inherit" }).status;
  } else if (combined.trim()) {
    process.stdout.write(combined);
  }

  if (exitCode !== 0) {
    console.warn(`${logPrefix} adb install 失败（exit ${exitCode ?? "?"}），打包产物仍保留`);
    return { status: "failed", reason: `install-exit-${exitCode ?? "?"}` };
  }
  console.log(`${logPrefix} 安装完成`);
  return { status: "installed", deviceCount: devices };
}

/** CLI：`bun scripts/try-adb-install-apk.ts <apk>` */
if (import.meta.main) {
  const apk = process.argv[2];
  if (!apk) {
    console.error("Usage: bun scripts/try-adb-install-apk.ts <apk-path>");
    process.exit(1);
  }
  tryAdbInstallApk(apk);
}
