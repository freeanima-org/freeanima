import type { ComponentBuildMeta } from "./build-meta.ts";
import {
  loadTauriNativeBuildMetaFromAssets,
  readNativeBuildMetaFromDefine,
} from "./native-build-meta.read.ts";
import { NATIVE_BUILD_META_KEY } from "./settings/prefs-keys.ts";
import { isTauriRuntime } from "./tauri-runtime.ts";

export const NATIVE_BUILD_META_CHANGED_EVENT = "freeanima:native-build-meta";

function readNativeBuildFromPortalShell(): ComponentBuildMeta | undefined {
  return window.portalShell?.nativeBuild;
}

function attachNativeBuildToPortalShell(meta: ComponentBuildMeta): void {
  if (!window.portalShell) return;
  window.portalShell = { ...window.portalShell, nativeBuild: meta };
  window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
}

/** 设置 → 关于：解析 native shell 构建信息（Tauri 从 index 内联 + /web/native-build-meta.json） */
export async function resolveAboutNativeBuildMeta(): Promise<ComponentBuildMeta | null> {
  const fromShellEarly = readNativeBuildFromPortalShell();
  if (fromShellEarly) return fromShellEarly;

  if (typeof window !== "undefined" && isTauriRuntime()) {
    const meta = await loadTauriNativeBuildMetaFromAssets();
    if (meta) {
      attachNativeBuildToPortalShell(meta);
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
    const afterBridge = readNativeBuildFromPortalShell();
    if (afterBridge) return afterBridge;
  }

  return readNativeBuildFromPortalShell() ?? null;
}

/** @internal 测试：从 define 解析 */
export { readNativeBuildMetaFromDefine, NATIVE_BUILD_META_KEY };
