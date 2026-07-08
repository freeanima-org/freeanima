import type { HubHealthBody } from "./hub-health-probe.ts";

type CapacitorHttpResponse = {
  status: number;
  data: unknown;
};

type CapacitorHttpModule = {
  get: (options: {
    url: string;
    headers?: Record<string, string>;
    connectTimeout?: number;
    readTimeout?: number;
  }) => Promise<CapacitorHttpResponse>;
};

function parseCapacitorHttpBody(data: unknown): HubHealthBody {
  if (typeof data === "string") {
    return JSON.parse(data) as HubHealthBody;
  }
  if (data && typeof data === "object") {
    return data as HubHealthBody;
  }
  throw new Error("Hub health 响应无效");
}

function hubOrigin(hubUrl: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(hubUrl.trim())
      ? hubUrl.trim()
      : `http://${hubUrl.trim()}`;
    return new URL(withScheme.replace(/\/$/, "")).origin;
  } catch {
    return "";
  }
}

/** Capacitor 原生 HTTP：绕过 WebView 混合内容与 CORS（bootstrap https://localhost → 局域网 Hub） */
export async function probeHubHealthViaCapacitorHttp(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<HubHealthBody> {
  const { Capacitor, CapacitorHttp } = (await import("@capacitor/core")) as {
    Capacitor: { isPluginAvailable: (name: string) => boolean };
    CapacitorHttp: CapacitorHttpModule;
  };
  if (!Capacitor.isPluginAvailable("CapacitorHttp")) {
    throw new Error("CapacitorHttp 不可用，请 cap sync 后重装 APK");
  }
  const response = await CapacitorHttp.get({
    url,
    headers,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parseCapacitorHttpBody(response.data);
}

export async function shouldProbeHubHealthViaCapacitorHttp(hubUrl: string): Promise<boolean> {
  const {
    isCapacitorNativePlatform,
    isMobileCapacitorShellCandidate,
    waitForCapacitorNativePlatform,
  } = await import("./capacitor-runtime.ts");
  let native = isCapacitorNativePlatform();
  if (
    !native &&
    typeof window !== "undefined" &&
    window.satelliteShell?.isNativeShell &&
    isMobileCapacitorShellCandidate()
  ) {
    native = await waitForCapacitorNativePlatform(1_500);
  }
  if (!native) return false;

  const page = typeof window !== "undefined" ? window.location.origin : "";
  const hub = hubOrigin(hubUrl);
  // 已在 Hub 远程页（如 http://10.244.0.244:2658/web/settings）：同源 fetch 与浏览器一致
  if (page && hub && page === hub) return false;

  return true;
}
