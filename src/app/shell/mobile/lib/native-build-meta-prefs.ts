import type { ComponentBuildMeta } from "@freeanima/shell-sdk/build-meta";
import { isCapacitorNativePlatform } from "@freeanima/shell-sdk/capacitor-runtime";
import { readNativeBuildMetaFromDefine } from "@freeanima/shell-sdk/native-build-meta.read";

import { NATIVE_BUILD_META_KEY } from "../../../../frontend/shell-sdk/settings/prefs-keys.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";

declare const __NATIVE_BUILD_META__: ComponentBuildMeta;

function readNativeBuildFromDefine(): ComponentBuildMeta | undefined {
  return readNativeBuildMetaFromDefine(
    typeof __NATIVE_BUILD_META__ !== "undefined" ? __NATIVE_BUILD_META__ : undefined,
  );
}

/** bootstrap 薄壳（含 Vite define）启动时写入 Preferences，供 Hub 远程 UI 桥接读取 */
export async function persistNativeBuildMetaFromDefine(): Promise<void> {
  const meta = readNativeBuildFromDefine();
  if (!meta) return;
  await prefsSet({ key: NATIVE_BUILD_META_KEY, value: JSON.stringify(meta) });
}

async function readNativeBuildFromPrefs(): Promise<ComponentBuildMeta | undefined> {
  if (!isCapacitorNativePlatform()) return undefined;
  const { value } = await prefsGet({ key: NATIVE_BUILD_META_KEY });
  if (!value?.trim()) return undefined;
  try {
    return readNativeBuildMetaFromDefine(JSON.parse(value));
  } catch {
    return undefined;
  }
}

/** Capacitor 本地 Web 服务器仍托管 www 静态资源，远程 Hub 页可回读 APK 内 meta */
async function readNativeBuildFromBundledAsset(): Promise<ComponentBuildMeta | undefined> {
  if (!isCapacitorNativePlatform()) return undefined;
  try {
    const res = await fetch("https://localhost/native-build-meta.json", { cache: "no-store" });
    if (!res.ok) return undefined;
    return readNativeBuildMetaFromDefine(await res.json());
  } catch {
    return undefined;
  }
}

let cachedNativeBuild: Promise<ComponentBuildMeta | undefined> | undefined;

/** Capacitor 壳层 native build meta：define → Preferences → APK 内 JSON */
export function loadMobileNativeBuildMeta(): Promise<ComponentBuildMeta | undefined> {
  if (!cachedNativeBuild) {
    cachedNativeBuild = (async () => {
      const fromDefine = readNativeBuildFromDefine();
      if (fromDefine) return fromDefine;
      const fromPrefs = await readNativeBuildFromPrefs();
      if (fromPrefs) return fromPrefs;
      const fromAsset = await readNativeBuildFromBundledAsset();
      if (fromAsset) {
        void prefsSet({ key: NATIVE_BUILD_META_KEY, value: JSON.stringify(fromAsset) });
      }
      return fromAsset;
    })();
  }
  return cachedNativeBuild;
}

/** 测试或 Preferences 更新后重置缓存 */
export function resetMobileNativeBuildMetaCacheForTests(): void {
  cachedNativeBuild = undefined;
}
