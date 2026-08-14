#!/usr/bin/env bun
/**
 * Tauri Android APK → dist/ 双写（版本化 + freeanima-mobile-android.apk + legacy tauri 别名）
 * 依赖：just install android + just install tauri-android
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { tryAdbInstallApk } from "./try-adb-install-apk.ts";
import { ensureApkSigned } from "./sign-android-apk.ts";
import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "packages/frontend/portal/app/tauri");
const androidGen = join(tauriDir, "src-tauri/gen/android");

function scoreApkPath(p: string): number {
  return (
    (p.includes("unsigned") ? -8 : 0) +
    (p.includes("release") ? 4 : 0) +
    (p.includes("debug") ? 3 : 0) +
    (p.includes("universal") ? 2 : 0) +
    (p.includes("aarch64") || p.includes("arm64") ? 1 : 0)
  );
}

function findApk(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const stack = [dir];
  const hits: string[] = [];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) break;
    for (const name of readdirSync(cur)) {
      const p = join(cur, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (
          name === "build" ||
          name === "apk" ||
          name === "outputs" ||
          name === "release" ||
          name === "debug" ||
          name === "universal" ||
          name === "arm64-v8a" ||
          name === "armeabi-v7a" ||
          name === "x86_64" ||
          name === "x86"
        ) {
          stack.push(p);
        } else if (!name.startsWith(".") && name !== "intermediates" && name !== ".gradle") {
          if (cur.includes("outputs") || cur.includes("apk")) stack.push(p);
        }
      } else if (name.endsWith(".apk")) {
        hits.push(p);
      }
    }
  }
  if (hits.length === 0) return null;
  // 优先：已签名 > release > universal > arm64
  hits.sort((a, b) => scoreApkPath(b) - scoreApkPath(a));
  return hits[0] ?? null;
}

if (!existsSync(androidGen)) {
  console.error(
    "[pack tauri-android] 尚未 gen/android。请先：just install tauri-android -- --init",
  );
  process.exit(1);
}

const patch = spawnSync("bun", ["scripts/patch-tauri-android.ts"], {
  cwd: root,
  stdio: "inherit",
});
if (patch.status !== 0) process.exit(patch.status ?? 1);

console.log("[pack tauri-android] brand icons…");
const brand = spawnSync("bun", ["scripts/generate-brand-icons.ts"], {
  cwd: root,
  stdio: "inherit",
});
if (brand.status !== 0) process.exit(brand.status ?? 1);

console.log("[pack tauri-android] prepare mobile ui…");
const prep = spawnSync("bun", ["scripts/prepare-tauri-ui.ts"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, FREEANIMA_TAURI_TARGET: "mobile" },
});
if (prep.status !== 0) process.exit(prep.status ?? 1);

const identity = applyTauriShellIdentity({ target: "mobile" });
const buildEnv = {
  ...process.env,
  FREEANIMA_BUILD_CHANNEL: identity.channel,
};

const build = spawnSync(
  "bun",
  ["x", "tauri", "android", "build", "--apk", "--config", identity.configArg],
  {
    cwd: tauriDir,
    stdio: "inherit",
    shell: true,
    env: buildEnv,
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const apk =
  findApk(join(androidGen, "app/build/outputs/apk")) ??
  findApk(join(tauriDir, "src-tauri/gen/android")) ??
  findApk(join(tauriDir, "src-tauri/target"));

if (!apk) {
  console.error("[pack tauri-android] 未找到生成的 APK");
  process.exit(1);
}

const emitted = emitPackArtifact({
  kind: "mobile-android-apk",
  sourcePath: apk,
  logPrefix: "[pack tauri-android]",
});
console.log(`[pack tauri-android] source: ${apk}`);
// 签名与 adb 走 stable（updater 名）或 legacy 本地名
const distApk = emitted.aliasPaths[0] ?? emitted.stablePath;
if (!ensureApkSigned(distApk, "[pack tauri-android]")) {
  process.exit(1);
}
// 签名可能只改了 distApk；同步回其它副本
for (const dest of [emitted.versionedPath, emitted.stablePath, ...emitted.aliasPaths]) {
  if (dest !== distApk) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(distApk, dest);
  }
}
tryAdbInstallApk(distApk, "[pack tauri-android]");
process.exit(0);
