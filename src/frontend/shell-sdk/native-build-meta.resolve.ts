import type { ComponentBuildMeta } from "./build-meta.ts";
import {
  loadTauriNativeBuildMetaFromAssets,
  readNativeBuildMetaFromDefine,
} from "./native-build-meta.read.ts";
import { NATIVE_BUILD_META_KEY } from "./settings/prefs-keys.ts";
import { isTauriRuntime } from "./tauri-runtime.ts";

export const NATIVE_BUILD_META_CHANGED_EVENT = "freeanima:native-build-meta";

function readNativeBuildFromSatelliteShell(): ComponentBuildMeta | undefined {
  return window.satelliteShell?.nativeBuild;
}

function attachNativeBuildToSatelliteShell(meta: ComponentBuildMeta): void {
  if (!window.satelliteShell) return;
  window.satelliteShell = { ...window.satelliteShell, nativeBuild: meta };
  window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
}

/** 设置 → 关于：解析 native shell 构建信息（Tauri 从 index 内联 + /web/native-build-meta.json） */
export async function resolveAboutNativeBuildMeta(): Promise<ComponentBuildMeta | null> {
  const fromShellEarly = readNativeBuildFromSatelliteShell();
  if (fromShellEarly) return fromShellEarly;

  if (typeof window !== "undefined" && isTauriRuntime()) {
    const meta = await loadTauriNativeBuildMetaFromAssets();
    if (meta) {
      attachNativeBuildToSatelliteShell(meta);
      return meta;
    }
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
  }

  return readNativeBuildFromSatelliteShell() ?? null;
}

/** @internal 测试：从 define 解析 */
export { readNativeBuildMetaFromDefine, NATIVE_BUILD_META_KEY };
