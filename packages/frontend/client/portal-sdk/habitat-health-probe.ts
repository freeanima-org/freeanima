import { isRecord } from "@freeanima/shared/util";
import { habitatHealthProbeUrl } from "@freeanima/shared/habitat-rpc/urls.ts";

import { buildBearerHeaders } from "./remote-auth.ts";

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

type PortalShellProbe = {
  isTauri?: boolean;
  isNativeShell?: boolean;
  primaryInput?: string;
};

function readPortalShellProbe(): PortalShellProbe | undefined {
  const shell: unknown = Reflect.get(globalThis, "portalShell");
  return isRecord(shell) ? shell : undefined;
}

function isTauriShellRuntime(): boolean {
  return Boolean(readPortalShellProbe()?.isTauri);
}

function isTouchNativeShellRuntime(): boolean {
  const shell = readPortalShellProbe();
  if (!shell?.isNativeShell && !shell?.isTauri) return false;
  return shell.primaryInput === "touch";
}

/** 原生探测 DNS/hosts 失败：勿回退 WebView（AsyncDns 仍会失败，掩盖真实错误） */
export function isHabitatHealthDnsOrHostsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return msg.includes("无法解析主机名") || msg.includes("无地址");
}

/** 供单测；将 fetch/网络失败映射为设置页可读文案 */
export function formatHabitatHealthProbeFetchError(err: unknown, habitatUrl?: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "连接超时";
  }
  if (err instanceof TypeError) {
    const httpsHabitat = habitatUrl?.trim().toLowerCase().startsWith("https://");
    const tauriShell = isTauriShellRuntime();
    const touchShell = isTouchNativeShellRuntime();
    if (tauriShell && !touchShell && httpsHabitat) {
      return "网络错误：桌面壳 HTTPS 需在本机信任栖息地的 mkcert 根 CA（设置页下载 rootCA.pem 并导入系统），或暂用 http://…:2658";
    }
    if (touchShell && httpsHabitat) {
      return "网络错误：壳层内 HTTPS 需在手机「设置 → 安全」安装 mkcert 根 CA（rootCA.pem），并重新安装 APK；或暂用 http://…:2658";
    }
    if (tauriShell && !touchShell) {
      return "网络错误（请检查栖息地地址与本机 hosts；WebView 对自定义域名可能解析失败，可先用 IP 验证）";
    }
    if (touchShell) {
      return "网络错误（请检查栖息地地址、ZeroTier 是否在线，以及栖息地是否监听 0.0.0.0）";
    }
    return "网络错误（请检查栖息地地址与网络）";
  }
  if (err instanceof Error && err.message) return err.message;
  return "连接失败";
}

async function probeHabitatHealthViaWebViewFetch(
  healthUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<HabitatHealthBody> {
  const res = await fetch(healthUrl, {
    headers,
    signal: probeAbortSignal(timeoutMs, signal),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  if (!isRecord(body)) {
    throw new Error("栖息地 health 响应不是对象");
  }
  return {
    ...(typeof body.status === "string" ? { status: body.status } : {}),
    ...(typeof body.authed === "boolean" ? { authed: body.authed } : {}),
    ...(typeof body.version === "string" ? { version: body.version } : {}),
  };
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
    const { probeHabitatHealthViaNativeHttp, shouldProbeHabitatHealthViaNativeHttp } =
      await import("./native-habitat-health-probe.ts");
    if (await shouldProbeHabitatHealthViaNativeHttp(base)) {
      try {
        return await probeHabitatHealthViaNativeHttp(healthUrl, headers, timeoutMs);
      } catch (nativeErr) {
        // DNS/hosts：不回退。TLS/网络：回退 WebView（与对话同信任链，避免 Android 原生不认用户 CA）
        if (isHabitatHealthDnsOrHostsError(nativeErr)) {
          throw nativeErr;
        }
        return await probeHabitatHealthViaWebViewFetch(
          healthUrl,
          headers,
          timeoutMs,
          options?.signal,
        );
      }
    }
    return await probeHabitatHealthViaWebViewFetch(healthUrl, headers, timeoutMs, options?.signal);
  } catch (err) {
    throw new Error(formatHabitatHealthProbeFetchError(err, habitatUrl), { cause: err });
  }
}

/** 设置页「测试连接」：可达且 authed 为 true；Tauri 壳额外探测 WebSocket（与实际 RPC 同路径）。 */
export async function testHabitatHealthConnection(
  habitatUrl: string,
  remoteAuthToken?: string,
): Promise<void> {
  const token = remoteAuthToken?.trim();
  const body = await probeHabitatHealthUrl(
    habitatUrl,
    token !== undefined && token.length > 0 ? { token } : {},
  );
  const reason = habitatHealthFailureReason(body);
  if (reason) throw new Error(reason);
  if (token && body.authed !== true) {
    throw new Error("栖息地可达，但认证失败：请检查 Service API Token");
  }

  if (isTauriShellRuntime()) {
    await probeHabitatRpcWebSocket(habitatUrl, token);
  }
}

/**
 * 实际业务走 WebView WebSocket + connect 鉴权；「测试连接」默认是原生 HTTP。
 * 在此补一轮 WS open（及可选 auth 握手），避免 HTTP 通但 WS/TLS/鉴权失败时误报成功。
 */
export async function probeHabitatRpcWebSocket(
  habitatUrl: string,
  authToken?: string,
  timeoutMs = 8_000,
): Promise<void> {
  const { resolveHabitatRpcWsUrl } = await import("@freeanima/shared/habitat-rpc/urls.ts");
  const { HABITAT_RPC_VERSION, parseHabitatRpcEnvelope, serializeHabitatRpcEnvelope } =
    await import("@freeanima/shared/habitat-rpc/protocol.ts");
  const base = habitatUrl.trim().replace(/\/$/, "");
  const wsUrl = resolveHabitatRpcWsUrl(base);
  const httpsHabitat = base.toLowerCase().startsWith("https://");
  const token = authToken?.trim();

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
          httpsHabitat
            ? "Habitat RPC WebSocket 超时：原生 HTTP 探测已通，但壳内 wss 失败。请确认本机/手机已信任栖息地 TLS（mkcert 根 CA），或暂用 http://…:2658"
            : "Habitat RPC WebSocket 超时：原生 HTTP 探测已通，但壳内 ws 未连通（检查地址、防火墙与反向代理 WebSocket）",
        ),
      );
    }, timeoutMs);
    ws.addEventListener("open", () => {
      if (!token) {
        finish();
        return;
      }
      try {
        ws.send(
          serializeHabitatRpcEnvelope({
            kind: "connect",
            payload: { protocol: HABITAT_RPC_VERSION, auth_token: token },
          }),
        );
      } catch (e) {
        finish(
          new Error(e instanceof Error ? e.message : "无法发送 Habitat RPC connect", { cause: e }),
        );
      }
    });
    ws.addEventListener("message", (ev) => {
      if (!token || typeof ev.data !== "string") return;
      try {
        const envelope = parseHabitatRpcEnvelope(ev.data);
        if (envelope.kind === "connected") {
          finish();
          return;
        }
      } catch {
        /* 忽略非握手帧 */
      }
    });
    ws.addEventListener("close", (ev) => {
      if (!token) return;
      const reason = ev.reason?.trim();
      finish(
        new Error(
          reason === "unauthorized"
            ? "Habitat RPC 鉴权失败：WebSocket 已通，但 Service API Token 无效"
            : reason
              ? `Habitat RPC 握手失败：${reason}`
              : "Habitat RPC 握手失败：连接在鉴权前被关闭",
        ),
      );
    });
    ws.addEventListener("error", () => {
      finish(
        new Error(
          httpsHabitat
            ? "Habitat RPC WebSocket 失败：测试连接的原生 HTTPS 可能已通，但 WebView 未信任该证书。请安装 mkcert 根 CA，或改用 http://…:2658"
            : "Habitat RPC WebSocket 失败：与「测试连接」原生 HTTP 路径不同，请检查 ws 地址与网络",
        ),
      );
    });
  });
}
