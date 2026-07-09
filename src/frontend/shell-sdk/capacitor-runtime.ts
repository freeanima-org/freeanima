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

/** 等待 Capacitor 注入 nativePromise（远程 Hub 页上 @capacitor/core 可能晚于 shell-bridge）。 */
export async function waitForCapacitorNativePromise(timeoutMs = 3_000): Promise<boolean> {
  if (hasCapacitorNativePromise()) return true;
  if (!isMobileCapacitorShellCandidate()) return false;

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
 * 移动壳 WebView（含远程 Hub 页）：Capacitor 注入脚本仅挂在 https://localhost，
 * 跳转到 Hub 后 window.Capacitor 可能尚未存在，但仍可通过 fetch localhost 读 APK 内资源。
 */
export function isMobileCapacitorShellCandidate(): boolean {
  const w = runtimeWindow();
  if (!w || w.satelliteShell?.isElectron) return false;
  if (isCapacitorNativePlatform()) return true;
  const ua = w.navigator?.userAgent ?? "";
  return /Android|iPhone|iPad|Mobile/i.test(ua);
}

/** 远程 Hub 页上 @capacitor/core 动态加载后 window.Capacitor 才可用 */
export async function waitForCapacitorNativePlatform(timeoutMs = 3_000): Promise<boolean> {
  if (isCapacitorNativePlatform()) return true;
  if (!isMobileCapacitorShellCandidate()) return false;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    if (isCapacitorNativePlatform()) return true;
  }
  return isCapacitorNativePlatform();
}
