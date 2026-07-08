import { isCapacitorNativePlatform, isMobileCapacitorShellCandidate } from "./capacitor-runtime.ts";

const DEFAULT_CAPACITOR_HOST = "localhost";
const DEFAULT_CAPACITOR_SCHEME = "https";

/** Capacitor 打包 www 内静态资源 URL（远程 Hub 页回读 APK 内 JSON 等） */
export function resolveCapacitorBundledAssetUrl(assetPath: string): string {
  const path = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  const cap = (
    window as Window & {
      Capacitor?: {
        config?: { androidScheme?: string; iosScheme?: string; hostname?: string };
        getPlatform?: () => string;
      };
    }
  ).Capacitor;
  const hostname = cap?.config?.hostname?.trim() || DEFAULT_CAPACITOR_HOST;
  const platform = cap?.getPlatform?.() ?? "web";
  const scheme =
    platform === "ios"
      ? cap?.config?.iosScheme?.trim() || DEFAULT_CAPACITOR_SCHEME
      : cap?.config?.androidScheme?.trim() || DEFAULT_CAPACITOR_SCHEME;
  return `${scheme}://${hostname}${path}`;
}

async function readJsonViaFetch(url: string): Promise<unknown | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

async function readJsonViaCapacitorHttp(url: string): Promise<unknown | undefined> {
  if (!isCapacitorNativePlatform()) return undefined;
  try {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.get({ url, responseType: "json" });
    if (res.status !== 200) return undefined;
    return res.data;
  } catch {
    return undefined;
  }
}

/** 读取 Capacitor www 内 JSON；WebView 会拦截 https://localhost 请求，无需 window.Capacitor */
export async function readCapacitorBundledJson(assetPath: string): Promise<unknown | undefined> {
  if (!isMobileCapacitorShellCandidate() && !isCapacitorNativePlatform()) return undefined;
  const url = resolveCapacitorBundledAssetUrl(assetPath);
  const fromFetch = await readJsonViaFetch(url);
  if (fromFetch != null) return fromFetch;
  return readJsonViaCapacitorHttp(url);
}

const CAPACITOR_BOOTSTRAP_PROBE_PATH = "/native-build-meta.json";

/**
 * Hub 托管 Web UI 的 bootstrap 分流：仅 Capacitor 原生或 WebView 内嵌壳（可读到 localhost 资产），
 * 普通手机浏览器（Safari/Chrome 直连 Hub）应走 Web bridge。
 */
export async function detectCapacitorShellForBootstrap(): Promise<boolean> {
  if (isCapacitorNativePlatform()) return true;
  if (!isMobileCapacitorShellCandidate()) return false;
  const meta = await readCapacitorBundledJson(CAPACITOR_BOOTSTRAP_PROBE_PATH);
  return meta != null;
}
