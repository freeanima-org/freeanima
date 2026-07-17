import {
  hasCapacitorNativePromise,
  isCapacitorNativePlatform,
  isCapacitorShellCandidate,
  waitForCapacitorNativePromise,
} from "./capacitor-runtime.ts";

const DEFAULT_CAPACITOR_HOST = "localhost";
const DEFAULT_CAPACITOR_SCHEME = "https";
/** 与 mobile `capacitor.config.json` androidScheme 默认一致；Capacitor 未注入时回退。 */
const DEFAULT_ANDROID_CAPACITOR_SCHEME = "http";

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
  let scheme = DEFAULT_CAPACITOR_SCHEME;
  if (platform === "ios") {
    scheme = cap?.config?.iosScheme?.trim() || DEFAULT_CAPACITOR_SCHEME;
  } else if (platform === "android") {
    scheme = cap?.config?.androidScheme?.trim() || DEFAULT_ANDROID_CAPACITOR_SCHEME;
  } else if (isCapacitorShellCandidate()) {
    // 远程 Hub 页上 window.Capacitor 可能尚未注入；Android 薄壳默认可读 http://localhost 资产
    scheme = cap?.config?.androidScheme?.trim() || DEFAULT_ANDROID_CAPACITOR_SCHEME;
  } else {
    scheme = cap?.config?.androidScheme?.trim() || DEFAULT_CAPACITOR_SCHEME;
  }
  return `${scheme}://${hostname}${path}`;
}

type CapacitorNativeBridge = {
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
};

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
  if (!hasCapacitorNativePromise()) return undefined;
  try {
    const w = window as Window & {
      __freeanimaCapacitorNative?: CapacitorNativeBridge;
      Capacitor?: CapacitorNativeBridge;
    };
    const cap = w.__freeanimaCapacitorNative?.nativePromise
      ? w.__freeanimaCapacitorNative
      : w.Capacitor;
    if (!cap?.nativePromise) return undefined;
    const res = (await cap.nativePromise("CapacitorHttp", "get", {
      url,
      responseType: "json",
    })) as { status?: number; data?: unknown };
    if (res.status !== 200) return undefined;
    return res.data;
  } catch {
    return undefined;
  }
}

/** 读取 Capacitor www 内 JSON；WebView 会拦截 https://localhost 请求，无需 window.Capacitor */
function alternateCapacitorAssetUrl(url: string): string | null {
  if (url.startsWith("https://")) return `http://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  return null;
}

function isCapacitorBundledAssetFetchAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const origin = window.location?.origin;
  if (!origin) return false;
  return /localhost/i.test(origin) || origin.startsWith("capacitor://");
}

export async function readCapacitorBundledJson(assetPath: string): Promise<unknown | undefined> {
  if (!isCapacitorShellCandidate() && !isCapacitorNativePlatform()) return undefined;
  const primaryUrl = resolveCapacitorBundledAssetUrl(assetPath);
  const urls = [primaryUrl];
  const alternate = alternateCapacitorAssetUrl(primaryUrl);
  if (alternate) urls.push(alternate);

  for (const url of urls) {
    const fromHttp = await readJsonViaCapacitorHttp(url);
    if (fromHttp != null) return fromHttp;
    if (isCapacitorBundledAssetFetchAllowed()) {
      const fromFetch = await readJsonViaFetch(url);
      if (fromFetch != null) return fromFetch;
    }
  }
  return undefined;
}

const CAPACITOR_BOOTSTRAP_PROBE_PATH = "/native-build-meta.json";

/**
 * Hub 托管 Web UI 的 bootstrap 分流：仅 Capacitor 原生或 WebView 内嵌壳（可读到 localhost 资产），
 * 普通手机浏览器（Safari/Chrome 直连 Hub）应走 Web bridge。
 */
export async function detectCapacitorShellForBootstrap(): Promise<boolean> {
  if (isCapacitorNativePlatform()) return true;
  if (!isCapacitorShellCandidate()) return false;

  // 远程 Hub 页跨域 fetch localhost 会 CORS 失败；Capacitor 8 以 nativePromise 为准。
  if (hasCapacitorNativePromise()) return true;
  if (await waitForCapacitorNativePromise(1_500)) return true;

  const meta = await readCapacitorBundledJson(CAPACITOR_BOOTSTRAP_PROBE_PATH);
  return meta != null;
}
