/** Capacitor WebView 运行时探测（不依赖 @capacitor/core 静态 import） */
export function isCapacitorNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}
