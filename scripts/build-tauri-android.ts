#!/usr/bin/env bun
/**
 * Tauri Android APK → dist/freeanima-mobile-tauri-android.apk
 * 依赖：just install-android + just install-android-tauri
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { tryAdbInstallApk } from "./try-adb-install-apk.ts";
import { ensureApkSigned } from "./sign-android-apk.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/app/shell/tauri");
const androidGen = join(tauriDir, "src-tauri/gen/android");
const distApk = join(root, "dist/freeanima-mobile-tauri-android.apk");

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
    "[package:android:tauri] 尚未 gen/android。请先：just install-android-tauri -- --init",
  );
  process.exit(1);
}

const patch = spawnSync("bun", ["scripts/patch-tauri-android.ts"], {
  cwd: root,
  stdio: "inherit",
});
if (patch.status !== 0) process.exit(patch.status ?? 1);

console.log("[package:android:tauri] prepare mobile ui…");
const prep = spawnSync("bun", ["scripts/prepare-tauri-ui.ts"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, FREEANIMA_TAURI_TARGET: "mobile" },
});
if (prep.status !== 0) process.exit(prep.status ?? 1);

const build = spawnSync("bunx", ["tauri", "android", "build", "--apk"], {
  cwd: tauriDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (build.status !== 0) process.exit(build.status ?? 1);

const apk =
  findApk(join(androidGen, "app/build/outputs/apk")) ??
  findApk(join(tauriDir, "src-tauri/gen/android")) ??
  findApk(join(tauriDir, "src-tauri/target"));

if (!apk) {
  console.error("[package:android:tauri] 未找到生成的 APK");
  process.exit(1);
}

mkdirSync(dirname(distApk), { recursive: true });
cpSync(apk, distApk);
console.log(`[package:android:tauri] ${apk}`);
console.log(`[package:android:tauri] → ${distApk}`);
if (!ensureApkSigned(distApk, "[package:android:tauri]")) {
  process.exit(1);
}
tryAdbInstallApk(distApk, "[package:android:tauri]");
process.exit(0);
