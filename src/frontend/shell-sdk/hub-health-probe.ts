import { buildBearerHeaders } from "./remote-auth.ts";
import { hubHealthProbeUrl } from "@freeanima/shared/hub-rpc/urls.ts";

export type HubHealthBody = {
  status?: string;
  authed?: boolean;
  version?: string;
};

export const HUB_HEALTH_PROBE_TIMEOUT_MS = 10_000;

export function isHubHealthConnected(body: HubHealthBody): boolean {
  return body.status === "ok" && body.authed !== false;
}

export function hubHealthFailureReason(body: HubHealthBody): string | null {
  if (body.status !== "ok") return "Hub 可达，但服务状态异常";
  if (body.authed === false) return "Hub 可达，但认证失败：请检查 Service API Token";
  return null;
}

function probeAbortSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  if (external) return external;
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  return controller.signal;
}

function isElectronShellRuntime(): boolean {
  if (typeof process !== "undefined" && Boolean(process.versions?.electron)) return true;
  return Boolean(
    (globalThis as { satelliteShell?: { isElectron?: boolean } }).satelliteShell?.isElectron,
  );
}

function isNativeMobileShellRuntime(): boolean {
  return Boolean(
    (globalThis as { satelliteShell?: { isNativeShell?: boolean } }).satelliteShell?.isNativeShell,
  );
}

/** 供单测；将 fetch/网络失败映射为设置页可读文案 */
export function formatHubHealthProbeFetchError(err: unknown, hubUrl?: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "连接超时";
  }
  if (err instanceof TypeError) {
    const httpsHub = hubUrl?.trim().toLowerCase().startsWith("https://");
    const electronShell = isElectronShellRuntime();
    const nativeShell = isNativeMobileShellRuntime();
    if (electronShell && httpsHub) {
      return "网络错误：桌面壳 HTTPS 需在本机信任栖息地的 mkcert 根 CA（设置页下载 rootCA.pem 并导入系统），或暂用 http://…:2658";
    }
    if (nativeShell && httpsHub) {
      return "网络错误：壳层内 HTTPS 需在手机「设置 → 安全」安装 mkcert 根 CA（rootCA.pem），并重新安装 APK；或暂用 http://…:2658";
    }
    if (nativeShell) {
      return "网络错误（请检查栖息地地址、ZeroTier 是否在线，以及栖息地是否监听 0.0.0.0）";
    }
    return "网络错误（请检查 栖息地地址与网络）";
  }
  if (err instanceof Error && err.message) return err.message;
  return "连接失败";
}

export async function probeHubHealthUrl(
  hubUrl: string,
  options?: { token?: string; timeoutMs?: number; signal?: AbortSignal },
): Promise<HubHealthBody> {
  const base = hubUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {};
  const token = options?.token?.trim();
  if (token) {
    Object.assign(headers, buildBearerHeaders(token));
  }
  const timeoutMs = options?.timeoutMs ?? HUB_HEALTH_PROBE_TIMEOUT_MS;
  const healthUrl = hubHealthProbeUrl(base);
  try {
    const { probeHubHealthViaCapacitorHttp, shouldProbeHubHealthViaCapacitorHttp } =
      await import("./native-hub-health-probe.ts");
    if (await shouldProbeHubHealthViaCapacitorHttp(base)) {
      try {
        return await probeHubHealthViaCapacitorHttp(healthUrl, headers, timeoutMs);
      } catch {
        /* CapacitorHttp 失败时回退 fetch（androidScheme http + Hub CORS localhost） */
      }
    }
    const res = await fetch(healthUrl, {
      headers,
      signal: probeAbortSignal(timeoutMs, options?.signal),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as HubHealthBody;
  } catch (err) {
    throw new Error(formatHubHealthProbeFetchError(err, hubUrl), { cause: err });
  }
}

/** 设置页「测试连接」：可达且 authed 为 true */
export async function testHubHealthConnection(
  hubUrl: string,
  remoteAuthToken?: string,
): Promise<void> {
  const body = await probeHubHealthUrl(
    hubUrl,
    remoteAuthToken !== undefined ? { token: remoteAuthToken } : {},
  );
  const reason = hubHealthFailureReason(body);
  if (reason) throw new Error(reason);
}
