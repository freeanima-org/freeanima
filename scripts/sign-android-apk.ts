/**
 * 为未签名 APK 补签名（本地 debug keystore，或 FREEANIMA_ANDROID_* upload keystore）。
 *
 * 环境变量（可选，CI release）：
 * - FREEANIMA_ANDROID_KEYSTORE_BASE64
 * - FREEANIMA_ANDROID_KEYSTORE_PASSWORD
 * - FREEANIMA_ANDROID_KEY_PASSWORD
 * - FREEANIMA_ANDROID_KEY_ALIAS
 *
 * 缺省：`~/.android/debug.keystore`（alias androiddebugkey / android）
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

function sdkHome(): string {
  return (
    process.env.ANDROID_HOME?.trim() ||
    process.env.ANDROID_SDK_ROOT?.trim() ||
    join(homedir(), "Android/Sdk")
  );
}

function resolveBuildTool(name: string): string | null {
  const root = join(sdkHome(), "build-tools");
  if (!existsSync(root)) return null;
  const versions = spawnSync("bash", ["-c", `ls -1 "${root}" | sort -V`], {
    encoding: "utf-8",
  })
    .stdout?.trim()
    .split("\n")
    .filter(Boolean);
  if (!versions?.length) return null;
  for (let i = versions.length - 1; i >= 0; i--) {
    const ver = versions[i];
    if (!ver) continue;
    const p = join(root, ver, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function apkHasCert(apkPath: string, apksigner: string): boolean {
  const r = spawnSync(apksigner, ["verify", apkPath], { encoding: "utf-8" });
  return r.status === 0;
}

type KeystoreMaterial = {
  path: string;
  alias: string;
  storePass: string;
  keyPass: string;
  cleanup?: () => void;
};

function resolveKeystore(): KeystoreMaterial {
  const b64 = process.env.FREEANIMA_ANDROID_KEYSTORE_BASE64?.trim();
  if (b64) {
    const alias = process.env.FREEANIMA_ANDROID_KEY_ALIAS?.trim() || "freeanima";
    const storePass = process.env.FREEANIMA_ANDROID_KEYSTORE_PASSWORD?.trim();
    const keyPass = process.env.FREEANIMA_ANDROID_KEY_PASSWORD?.trim() || storePass;
    if (!storePass || !keyPass) {
      throw new Error(
        "已设 FREEANIMA_ANDROID_KEYSTORE_BASE64，但缺少 KEYSTORE_PASSWORD / KEY_PASSWORD",
      );
    }
    const dir = mkdtempSync(join(tmpdir(), "fa-android-ks-"));
    const path = join(dir, "upload.jks");
    writeFileSync(path, Buffer.from(b64, "base64"));
    return {
      path,
      alias,
      storePass,
      keyPass,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  }

  const debugKs = join(homedir(), ".android/debug.keystore");
  if (!existsSync(debugKs)) {
    throw new Error(
      `未找到 ${debugKs}，且未配置 FREEANIMA_ANDROID_KEYSTORE_BASE64。请先跑一次 Android Studio / adb，或配置上传密钥。`,
    );
  }
  return {
    path: debugKs,
    alias: "androiddebugkey",
    storePass: "android",
    keyPass: "android",
  };
}

/** 若 APK 无证书则签名（原地）。成功返回 true。 */
export function ensureApkSigned(apkPath: string, logPrefix = "[sign-apk]"): boolean {
  if (!existsSync(apkPath)) {
    console.error(`${logPrefix} APK 不存在：${apkPath}`);
    return false;
  }
  const apksigner = resolveBuildTool("apksigner");
  if (!apksigner) {
    console.error(`${logPrefix} 未找到 build-tools/apksigner（ANDROID_HOME=${sdkHome()}）`);
    return false;
  }
  if (apkHasCert(apkPath, apksigner)) {
    console.log(`${logPrefix} 已有签名，跳过`);
    return true;
  }

  const ks = resolveKeystore();
  try {
    console.log(`${logPrefix} 未签名，使用 ${ks.alias}@${ks.path} 签名…`);
    const r = spawnSync(
      apksigner,
      [
        "sign",
        "--ks",
        ks.path,
        "--ks-key-alias",
        ks.alias,
        "--ks-pass",
        `pass:${ks.storePass}`,
        "--key-pass",
        `pass:${ks.keyPass}`,
        apkPath,
      ],
      { stdio: "inherit" },
    );
    if (r.status !== 0) {
      console.error(`${logPrefix} apksigner 失败`);
      return false;
    }
    if (!apkHasCert(apkPath, apksigner)) {
      console.error(`${logPrefix} 签名后校验仍失败`);
      return false;
    }
    console.log(`${logPrefix} 签名完成`);
    return true;
  } finally {
    ks.cleanup?.();
  }
}

if (import.meta.main) {
  const apk = process.argv[2];
  if (!apk) {
    console.error("Usage: bun scripts/sign-android-apk.ts <apk-path>");
    process.exit(1);
  }
  process.exit(ensureApkSigned(apk) ? 0 : 1);
}
