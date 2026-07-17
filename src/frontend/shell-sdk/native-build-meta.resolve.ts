import type { ComponentBuildMeta } from "./build-meta.ts";
import { readCapacitorBundledJson } from "./capacitor-local-asset.ts";
import {
  isCapacitorNativePlatform,
  isCapacitorShellCandidate,
  waitForCapacitorNativePlatform,
} from "./capacitor-runtime.ts";
import { readNativeBuildMetaFromDefine } from "./native-build-meta.read.ts";
import { NATIVE_BUILD_META_KEY } from "./settings/prefs-keys.ts";

export const NATIVE_BUILD_META_CHANGED_EVENT = "freeanima:native-build-meta";

async function readCapacitorPreference(key: string): Promise<string | null> {
  try {
    const { createPreferencesApiFromNativeBridge, pinCapacitorNativeBridge } =
      await import("@freeanima/app/shell/mobile/lib/capacitor-plugins.ts");
    pinCapacitorNativeBridge();
    const prefs = createPreferencesApiFromNativeBridge();
    if (!prefs) return null;
    const { value } = await prefs.get({ key });
    return value?.trim() || null;
  } catch {
    return null;
  }
}

async function readNativeBuildFromCapacitorPrefs(): Promise<ComponentBuildMeta | undefined> {
  const raw = await readCapacitorPreference(NATIVE_BUILD_META_KEY);
  if (!raw) return undefined;
  try {
    return readNativeBuildMetaFromDefine(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

async function readNativeBuildFromCapacitorAsset(): Promise<ComponentBuildMeta | undefined> {
  const raw = await readCapacitorBundledJson("/native-build-meta.json");
  return raw != null ? readNativeBuildMetaFromDefine(raw) : undefined;
}

function readNativeBuildFromSatelliteShell(): ComponentBuildMeta | undefined {
  return window.satelliteShell?.nativeBuild;
}

function attachNativeBuildToSatelliteShell(meta: ComponentBuildMeta): void {
  if (!window.satelliteShell) return;
  window.satelliteShell = { ...window.satelliteShell, nativeBuild: meta };
  window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
}

/** 设置 → 关于：解析 native shell 构建信息（Capacitor 远程 Hub UI 从 APK 资产 / Preferences 读取） */
export async function resolveAboutNativeBuildMeta(): Promise<ComponentBuildMeta | null> {
  if (!isCapacitorShellCandidate() && !isCapacitorNativePlatform()) {
    const fromShellOnly = readNativeBuildFromSatelliteShell();
    return fromShellOnly ?? null;
  }

  const fromShell = readNativeBuildFromSatelliteShell();
  if (fromShell) return fromShell;

  // 远程 Hub 页：WebView 拦截 https://localhost，不依赖 window.Capacitor
  const fromAsset = await readNativeBuildFromCapacitorAsset();
  if (fromAsset) {
    attachNativeBuildToSatelliteShell(fromAsset);
    return fromAsset;
  }

  await waitForCapacitorNativePlatform();

  const fromPrefs = await readNativeBuildFromCapacitorPrefs();
  if (fromPrefs) {
    attachNativeBuildToSatelliteShell(fromPrefs);
    return fromPrefs;
  }

  const bridgeReady = (window as Window & { __freeanimaShellBridge?: { ready?: Promise<void> } })
    .__freeanimaShellBridge?.ready;
  if (bridgeReady) {
    try {
      await bridgeReady;
    } catch {
      /* ignore */
    }
    const afterBridge = readNativeBuildFromSatelliteShell();
    if (afterBridge) return afterBridge;

    const afterAsset = await readNativeBuildFromCapacitorAsset();
    if (afterAsset) {
      attachNativeBuildToSatelliteShell(afterAsset);
      return afterAsset;
    }

    const afterPrefs = await readNativeBuildFromCapacitorPrefs();
    if (afterPrefs) {
      attachNativeBuildToSatelliteShell(afterPrefs);
      return afterPrefs;
    }
  }

  return null;
}
