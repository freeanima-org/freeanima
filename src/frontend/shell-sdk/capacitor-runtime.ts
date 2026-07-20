function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

type CapacitorNativeBridge = {
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
  isNativePlatform?: () => boolean;
};

function readCapacitorNativeBridge(): CapacitorNativeBridge | undefined {
  const w = runtimeWindow();
  if (!w) return undefined;
  const pinned = (w as Window & { __freeanimaCapacitorNative?: CapacitorNativeBridge })
    .__freeanimaCapacitorNative;
  if (pinned?.nativePromise) return pinned;
  const live = (w as Window & { Capacitor?: CapacitorNativeBridge }).Capacitor;
  return live?.nativePromise ? live : undefined;
}

/** Capacitor 8 原生桥（nativePromise）是否可用；优先读 shell-bridge pin 的副本。 */
export function hasCapacitorNativePromise(): boolean {
  return Boolean(readCapacitorNativeBridge()?.nativePromise);
}

/** 等待 Capacitor 注入 nativePromise（远程 Habitat 页上 @capacitor/core 可能晚于 shell-bridge）。 */
export async function waitForCapacitorNativePromise(timeoutMs = 3_000): Promise<boolean> {
  if (hasCapacitorNativePromise()) return true;
  if (!isCapacitorShellCandidate()) return false;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    if (hasCapacitorNativePromise()) return true;
  }
  return hasCapacitorNativePromise();
}

/** Capacitor WebView 运行时探测（不依赖 @capacitor/core 静态 import） */
export function isCapacitorNativePlatform(): boolean {
  const cap = readCapacitorNativeBridge();
  if (cap?.isNativePlatform?.()) return true;
  return Boolean(cap?.nativePromise);
}

/**
 * Capacitor 壳「候选」探测（软信号，供 bootstrap / 资产探测等继续等待或试读）。
 *
 * - 已有 nativePromise / isNativeShell → 真壳
 * - 薄壳首页（localhost / capacitor://）+ 移动 UA → 可试读 APK 内资产
 * - **禁止**仅凭远程 Habitat 上的手机 UA 判为壳：普通 Safari/Chrome 直连 `/web` 必须走 Web bridge
 *   （能力层跟壳，不跟 UA；布局轴另由 viewport 决定）
 */
export function isCapacitorShellCandidate(): boolean {
  const w = runtimeWindow();
  if (!w || w.satelliteShell?.isElectron) return false;
  if (isCapacitorNativePlatform()) return true;
  if (w.satelliteShell?.isNativeShell) return true;
  const origin = w.location?.origin ?? "";
  const onThinShellOrigin = /localhost/i.test(origin) || origin.startsWith("capacitor://");
  if (!onThinShellOrigin) return false;
  const ua = w.navigator?.userAgent ?? "";
  return /Android|iPhone|iPad|Mobile/i.test(ua);
}

/** 远程 Habitat 页上 @capacitor/core 动态加载后 window.Capacitor 才可用 */
export async function waitForCapacitorNativePlatform(timeoutMs = 3_000): Promise<boolean> {
  if (isCapacitorNativePlatform()) return true;
  if (!isCapacitorShellCandidate()) return false;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    if (isCapacitorNativePlatform()) return true;
  }
  return isCapacitorNativePlatform();
}
