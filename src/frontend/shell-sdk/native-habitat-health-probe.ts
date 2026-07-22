import type { HabitatHealthBody } from "./habitat-health-probe.ts";

type CapacitorHttpResponse = {
  status: number;
  data: unknown;
};

function parseCapacitorHttpBody(data: unknown): HabitatHealthBody {
  if (typeof data === "string") {
    return JSON.parse(data) as HabitatHealthBody;
  }
  if (data && typeof data === "object") {
    return data as HabitatHealthBody;
  }
  throw new Error("栖息地 health 响应无效");
}

function hubOrigin(habitatUrl: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(habitatUrl.trim())
      ? habitatUrl.trim()
      : `http://${habitatUrl.trim()}`;
    return new URL(withScheme.replace(/\/$/, "")).origin;
  } catch {
    return "";
  }
}

/** Capacitor / Tauri 原生 HTTP：绕过 WebView CORS / AsyncDns（hosts 主机名） */
export async function probeHabitatHealthViaCapacitorHttp(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<HabitatHealthBody> {
  if (typeof window !== "undefined" && window.satelliteShell?.isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const rawAuth = headers.authorization ?? headers.Authorization ?? "";
    const token = rawAuth.replace(/^Bearer\s+/i, "").trim();
    const body = await invoke<HabitatHealthBody>("probe_habitat_health", {
      url,
      token: token || null,
      timeoutMs,
    });
    return body;
  }
  const { hasCapacitorNativePromise } = await import("./capacitor-runtime.ts");
  if (!hasCapacitorNativePromise()) {
    throw new Error("原生 HTTP 探测不可用（非 Tauri / 无 Capacitor 桥）");
  }
  const w = window as Window & {
    __freeanimaCapacitorNative?: { nativePromise?: CapacitorNativeInvoker };
    Capacitor?: { nativePromise?: CapacitorNativeInvoker };
  };
  const cap = w.__freeanimaCapacitorNative?.nativePromise
    ? w.__freeanimaCapacitorNative
    : w.Capacitor;
  if (!cap?.nativePromise) {
    throw new Error("原生 HTTP 探测不可用（非 Tauri / 无 Capacitor 桥）");
  }
  const response = (await cap.nativePromise("CapacitorHttp", "get", {
    url,
    headers,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  })) as CapacitorHttpResponse;
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parseCapacitorHttpBody(response.data);
}

type CapacitorNativeInvoker = (
  plugin: string,
  method: string,
  options?: object,
) => Promise<unknown>;

export async function shouldProbeHubHealthViaCapacitorHttp(habitatUrl: string): Promise<boolean> {
  if (typeof window !== "undefined" && window.satelliteShell?.isTauri) {
    const page = window.location.origin;
    const hub = hubOrigin(habitatUrl);
    if (page && hub && page === hub) return false;
    return true;
  }
  const { isCapacitorNativePlatform, isCapacitorShellCandidate, waitForCapacitorNativePlatform } =
    await import("./capacitor-runtime.ts");
  let native = isCapacitorNativePlatform();
  if (
    !native &&
    typeof window !== "undefined" &&
    window.satelliteShell?.isNativeShell &&
    isCapacitorShellCandidate()
  ) {
    native = await waitForCapacitorNativePlatform(1_500);
  }
  if (!native) return false;

  const page = typeof window !== "undefined" ? window.location.origin : "";
  const hub = hubOrigin(habitatUrl);
  // 已在 Habitat 远程页（如 http://10.244.0.244:2658/web/settings）：同源 fetch 与浏览器一致
  if (page && hub && page === hub) return false;

  return true;
}
