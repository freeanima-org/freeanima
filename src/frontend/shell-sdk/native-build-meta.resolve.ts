import type { ComponentBuildMeta } from "./build-meta.ts";
import { isCapacitorNativePlatform } from "./capacitor-runtime.ts";
import { readNativeBuildMetaFromDefine } from "./native-build-meta.read.ts";
import { NATIVE_BUILD_META_KEY } from "./settings/prefs-keys.ts";

const CAPACITOR_LOCAL_META_URL = "https://localhost/native-build-meta.json";

async function readCapacitorPreference(key: string): Promise<string | null> {
  if (!isCapacitorNativePlatform()) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value?.trim() || null;
  } catch {
    /* fall through */
  }
  try {
    const prefs = (
      window as Window & {
        Capacitor?: {
          Plugins?: {
            Preferences?: { get(options: { key: string }): Promise<{ value: string | null }> };
          };
        };
      }
    ).Capacitor?.Plugins?.Preferences;
    if (!prefs?.get) return null;
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
  if (!isCapacitorNativePlatform()) return undefined;
  try {
    const res = await fetch(CAPACITOR_LOCAL_META_URL, { cache: "no-store" });
    if (!res.ok) return undefined;
    return readNativeBuildMetaFromDefine(await res.json());
  } catch {
    return undefined;
  }
}

function readNativeBuildFromSatelliteShell(): ComponentBuildMeta | undefined {
  return window.satelliteShell?.nativeBuild;
}

function attachNativeBuildToSatelliteShell(meta: ComponentBuildMeta): void {
  if (!window.satelliteShell) return;
  window.satelliteShell = { ...window.satelliteShell, nativeBuild: meta };
}

/** 设置 → 关于：解析 native shell 构建信息（Capacitor 远程 Hub UI 从 Preferences / APK 资产读取） */
export async function resolveAboutNativeBuildMeta(): Promise<ComponentBuildMeta | null> {
  const fromShell = readNativeBuildFromSatelliteShell();
  if (fromShell) return fromShell;

  const fromPrefs = await readNativeBuildFromCapacitorPrefs();
  if (fromPrefs) {
    attachNativeBuildToSatelliteShell(fromPrefs);
    return fromPrefs;
  }

  const fromAsset = await readNativeBuildFromCapacitorAsset();
  if (fromAsset) {
    attachNativeBuildToSatelliteShell(fromAsset);
    return fromAsset;
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

    const afterPrefs = await readNativeBuildFromCapacitorPrefs();
    if (afterPrefs) {
      attachNativeBuildToSatelliteShell(afterPrefs);
      return afterPrefs;
    }
  }

  return null;
}

export const NATIVE_BUILD_META_CHANGED_EVENT = "freeanima:native-build-meta";
