import type { ComponentBuildMeta } from "@freeanima/frontend/shell-sdk/build-meta";
import { readCapacitorBundledJson } from "@freeanima/frontend/shell-sdk/capacitor-local-asset";
import { isCapacitorNativePlatform } from "@freeanima/frontend/shell-sdk/capacitor-runtime";
import { readNativeBuildMetaFromDefine } from "@freeanima/frontend/shell-sdk/native-build-meta.read";

import { NATIVE_BUILD_META_KEY } from "@freeanima/frontend/shell-sdk/settings/prefs-keys.ts";
import { prefsGet, prefsSet } from "./prefs-safe.ts";

declare const __NATIVE_BUILD_META__: ComponentBuildMeta;

function readNativeBuildFromDefine(): ComponentBuildMeta | undefined {
  return readNativeBuildMetaFromDefine(
    typeof __NATIVE_BUILD_META__ !== "undefined" ? __NATIVE_BUILD_META__ : undefined,
  );
}

/** 写入 Preferences，供 Hub 远程 UI 桥接读取 */
export async function persistNativeBuildMeta(meta: ComponentBuildMeta): Promise<void> {
  if (!isCapacitorNativePlatform()) return;
  await prefsSet({ key: NATIVE_BUILD_META_KEY, value: JSON.stringify(meta) });
}

/** bootstrap 薄壳（含 Vite define）启动时写入 Preferences，供 Hub 远程 UI 桥接读取 */
export async function persistNativeBuildMetaFromDefine(): Promise<void> {
  const meta = readNativeBuildFromDefine();
  if (!meta) return;
  await persistNativeBuildMeta(meta);
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
  const raw = await readCapacitorBundledJson("/native-build-meta.json");
  return raw != null ? readNativeBuildMetaFromDefine(raw) : undefined;
}

async function loadMobileNativeBuildMetaUncached(): Promise<ComponentBuildMeta | undefined> {
  const fromDefine = readNativeBuildFromDefine();
  if (fromDefine) return fromDefine;
  const fromAsset = await readNativeBuildFromBundledAsset();
  if (fromAsset) return fromAsset;
  const fromPrefs = await readNativeBuildFromPrefs();
  if (fromPrefs) return fromPrefs;
  return undefined;
}

let cachedNativeBuild: Promise<ComponentBuildMeta | undefined> | undefined;

/** Capacitor 壳层 native build meta：define → APK JSON → Preferences */
export function loadMobileNativeBuildMeta(): Promise<ComponentBuildMeta | undefined> {
  if (!cachedNativeBuild) {
    cachedNativeBuild = loadMobileNativeBuildMetaUncached()
      .then((meta) => {
        if (!meta) cachedNativeBuild = undefined;
        return meta;
      })
      .catch((err: unknown) => {
        cachedNativeBuild = undefined;
        throw err;
      });
  }
  return cachedNativeBuild;
}

/** 测试或 Preferences 更新后重置缓存 */
export function resetMobileNativeBuildMetaCacheForTests(): void {
  cachedNativeBuild = undefined;
}
