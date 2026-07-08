function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

/** Capacitor WebView 运行时探测（不依赖 @capacitor/core 静态 import） */
export function isCapacitorNativePlatform(): boolean {
  const w = runtimeWindow();
  if (!w) return false;
  const cap = (w as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
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
