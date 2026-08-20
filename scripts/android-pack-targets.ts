/**
 * Android APK 目标 ABI（Tauri `--target` 短名 ↔ rustup target）。
 * 默认只编 aarch64（真机主流）；`FREEANIMA_ANDROID_TARGETS=all` 恢复四 ABI。
 */

export const ANDROID_ABI_SHORT = ["aarch64", "armv7", "i686", "x86_64"] as const;
export type AndroidAbiShort = (typeof ANDROID_ABI_SHORT)[number];

export const ANDROID_RUST_BY_ABI: Record<AndroidAbiShort, string> = {
  aarch64: "aarch64-linux-android",
  armv7: "armv7-linux-androideabi",
  i686: "i686-linux-android",
  x86_64: "x86_64-linux-android",
};

/** 与 sdkmanager `ndk;…` / cache key 对齐 */
export const ANDROID_NDK_PACKAGE = "ndk;27.0.12077973";

const SHORT_SET = new Set<string>(ANDROID_ABI_SHORT);

export function resolveAndroidPackAbis(env: NodeJS.ProcessEnv = process.env): AndroidAbiShort[] {
  const raw = env.FREEANIMA_ANDROID_TARGETS?.trim();
  if (!raw || raw === "default") return ["aarch64"];
  if (raw === "all") return [...ANDROID_ABI_SHORT];

  const parts = raw
    .split(/[,\s]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return ["aarch64"];

  const out: AndroidAbiShort[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (!SHORT_SET.has(p)) {
      throw new Error(
        `未知 FREEANIMA_ANDROID_TARGETS 项「${p}」。允许：${ANDROID_ABI_SHORT.join("|")}|all`,
      );
    }
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p as AndroidAbiShort);
  }
  return out.length > 0 ? out : ["aarch64"];
}

export function rustTargetsForAbis(abis: readonly AndroidAbiShort[]): string[] {
  return abis.map((a) => ANDROID_RUST_BY_ABI[a]);
}

/** 传给 `tauri android build` 的 `--target` 参数序列 */
export function tauriAndroidTargetArgs(abis: readonly AndroidAbiShort[]): string[] {
  const args: string[] = [];
  for (const abi of abis) {
    args.push("--target", abi);
  }
  return args;
}
