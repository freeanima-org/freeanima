import { buildBearerHeaders } from "./remote-auth.ts";
import { habitatHealthProbeUrl } from "@freeanima/shared/habitat-rpc/urls.ts";

export type HabitatHealthBody = {
  status?: string;
  authed?: boolean;
  version?: string;
};

export const HABITAT_HEALTH_PROBE_TIMEOUT_MS = 10_000;

export function isHabitatHealthConnected(body: HabitatHealthBody): boolean {
  return body.status === "ok" && body.authed !== false;
}

export function habitatHealthFailureReason(body: HabitatHealthBody): string | null {
  if (body.status !== "ok") return "栖息地可达，但服务状态异常";
  if (body.authed === false) return "栖息地可达，但认证失败：请检查 Service API Token";
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

function isTauriShellRuntime(): boolean {
  return Boolean(
    (globalThis as { satelliteShell?: { isTauri?: boolean } }).satelliteShell?.isTauri,
  );
}

function isNativeMobileShellRuntime(): boolean {
  const shell = (
    globalThis as {
      satelliteShell?: { isNativeShell?: boolean; isTauri?: boolean; isElectron?: boolean };
    }
  ).satelliteShell;
  // Tauri / Electron 桌面也带 isNativeShell，勿套用移动端文案
  if (shell?.isTauri || shell?.isElectron) return false;
  return Boolean(shell?.isNativeShell);
}

/** 供单测；将 fetch/网络失败映射为设置页可读文案 */
export function formatHabitatHealthProbeFetchError(err: unknown, habitatUrl?: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "连接超时";
  }
  if (err instanceof TypeError) {
    const httpsHub = habitatUrl?.trim().toLowerCase().startsWith("https://");
    const electronShell = isElectronShellRuntime();
    const tauriShell = isTauriShellRuntime();
    const nativeShell = isNativeMobileShellRuntime();
    if ((electronShell || tauriShell) && httpsHub) {
      return "网络错误：桌面壳 HTTPS 需在本机信任栖息地的 mkcert 根 CA（设置页下载 rootCA.pem 并导入系统），或暂用 http://…:2658";
    }
    if (nativeShell && httpsHub) {
      return "网络错误：壳层内 HTTPS 需在手机「设置 → 安全」安装 mkcert 根 CA（rootCA.pem），并重新安装 APK；或暂用 http://…:2658";
    }
    if (tauriShell) {
      return "网络错误（请检查栖息地地址与本机 hosts；WebView 对自定义域名可能解析失败，可先用 IP 验证）";
    }
    if (nativeShell) {
      return "网络错误（请检查栖息地地址、ZeroTier 是否在线，以及栖息地是否监听 0.0.0.0）";
    }
    return "网络错误（请检查栖息地地址与网络）";
  }
  if (err instanceof Error && err.message) return err.message;
  return "连接失败";
}

export async function probeHabitatHealthUrl(
  habitatUrl: string,
  options?: { token?: string; timeoutMs?: number; signal?: AbortSignal },
): Promise<HabitatHealthBody> {
  const base = habitatUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {};
  const token = options?.token?.trim();
  if (token) {
    Object.assign(headers, buildBearerHeaders(token));
  }
  const timeoutMs = options?.timeoutMs ?? HABITAT_HEALTH_PROBE_TIMEOUT_MS;
  const healthUrl = habitatHealthProbeUrl(base);
  try {
    const { probeHabitatHealthViaCapacitorHttp, shouldProbeHubHealthViaCapacitorHttp } =
      await import("./native-habitat-health-probe.ts");
    if (await shouldProbeHubHealthViaCapacitorHttp(base)) {
      try {
        return await probeHabitatHealthViaCapacitorHttp(healthUrl, headers, timeoutMs);
      } catch (nativeErr) {
        // Tauri 原生探测失败时不要回退 WebView fetch（hosts / AsyncDns 仍会失败，掩盖真实错误）
        if (
          typeof window !== "undefined" &&
          (window as Window & { satelliteShell?: { isTauri?: boolean } }).satelliteShell?.isTauri
        ) {
          throw nativeErr;
        }
        /* CapacitorHttp 失败时回退 fetch（androidScheme http + Habitat CORS localhost） */
      }
    }
    const res = await fetch(healthUrl, {
      headers,
      signal: probeAbortSignal(timeoutMs, options?.signal),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as HabitatHealthBody;
  } catch (err) {
    throw new Error(formatHabitatHealthProbeFetchError(err, habitatUrl), { cause: err });
  }
}

/** 设置页「测试连接」：可达且 authed 为 true；Tauri 壳额外探测 WebSocket（与实际 RPC 同路径）。 */
export async function testHabitatHealthConnection(
  habitatUrl: string,
  remoteAuthToken?: string,
): Promise<void> {
  const body = await probeHabitatHealthUrl(
    habitatUrl,
    remoteAuthToken !== undefined ? { token: remoteAuthToken } : {},
  );
  const reason = habitatHealthFailureReason(body);
  if (reason) throw new Error(reason);

  if (isTauriShellRuntime()) {
    await probeHabitatRpcWebSocket(habitatUrl);
  }
}

/**
 * 实际业务走 WebView WebSocket；「测试连接」默认是原生 HTTP。
 * 在此补一轮 WS open，避免 HTTP 通但 WS/TLS 失败时误报成功。
 */
export async function probeHabitatRpcWebSocket(
  habitatUrl: string,
  timeoutMs = 8_000,
): Promise<void> {
  const { resolveHabitatRpcWsUrl } = await import("@freeanima/shared/habitat-rpc/urls.ts");
  const base = habitatUrl.trim().replace(/\/$/, "");
  const wsUrl = resolveHabitatRpcWsUrl(base);
  const httpsHub = base.toLowerCase().startsWith("https://");

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      reject(
        new Error(e instanceof Error ? e.message : "无法创建 Habitat RPC WebSocket", { cause: e }),
      );
      return;
    }
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => {
      finish(
        new Error(
          httpsHub
            ? "Habitat RPC WebSocket 超时：原生 HTTP 探测已通，但壳内 wss 失败。请确认本机/手机已信任栖息地 TLS（mkcert 根 CA），或暂用 http://…:2658"
            : "Habitat RPC WebSocket 超时：原生 HTTP 探测已通，但壳内 ws 未连通（检查地址、防火墙与反向代理 WebSocket）",
        ),
      );
    }, timeoutMs);
    ws.addEventListener("open", () => finish());
    ws.addEventListener("error", () => {
      finish(
        new Error(
          httpsHub
            ? "Habitat RPC WebSocket 失败：测试连接的原生 HTTPS 可能已通，但 WebView 未信任该证书。请安装 mkcert 根 CA，或改用 http://…:2658"
            : "Habitat RPC WebSocket 失败：与「测试连接」原生 HTTP 路径不同，请检查 ws 地址与网络",
        ),
      );
    });
  });
}
