import { buildBearerHeaders } from "./remote-auth.ts";

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
  if (body.status !== "ok") return "服务异常";
  if (body.authed === false) return "认证失败";
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

function probeFetchErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "连接超时";
  }
  if (err instanceof TypeError) {
    return "网络错误（请检查 Hub 地址与网络）";
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
  try {
    const res = await fetch(`${base}/api/health`, {
      headers,
      signal: probeAbortSignal(timeoutMs, options?.signal),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as HubHealthBody;
  } catch (err) {
    throw new Error(probeFetchErrorMessage(err), { cause: err });
  }
}

/** 设置页「测试连接」：可达且 authed 为 true */
export async function testHubHealthConnection(
  hubUrl: string,
  remoteAuthToken?: string,
): Promise<void> {
  const body = await probeHubHealthUrl(hubUrl, { token: remoteAuthToken });
  const reason = hubHealthFailureReason(body);
  if (reason) throw new Error(reason);
}
