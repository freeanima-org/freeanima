import { randomPublicId } from "@freeanima/shared/util";
import { encodeFederationFrame, parseFederationFrame } from "./handshake.ts";
import { getFederationManager } from "./runtime-context.ts";

type Pending = {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, Pending>();
const REQUEST_TIMEOUT_MS = 30_000;

type SatelliteTransport = {
  sendRaw: (data: string) => void;
  onFrame: (handler: (method: string, payload: unknown) => void) => () => void;
};

let transport: SatelliteTransport | null = null;

export function bindSatelliteFederationTransport(next: SatelliteTransport | null): void {
  transport = next;
}

export function handleSatelliteRpcResult(method: string, payload: unknown): boolean {
  if (!method.endsWith(".result") && !method.endsWith(".error")) return false;
  const rec =
    typeof payload === "object" && payload != null
      ? (payload as { request_id?: unknown; error?: unknown; result?: unknown })
      : null;
  const requestId = typeof rec?.request_id === "string" ? rec.request_id : null;
  if (!requestId) return false;
  const entry = pending.get(requestId);
  if (!entry) return false;
  pending.delete(requestId);
  clearTimeout(entry.timer);
  if (method.endsWith(".error")) {
    entry.reject(new Error(typeof rec?.error === "string" ? rec.error : "federation rpc error"));
    return true;
  }
  entry.resolve(rec?.result);
  return true;
}

export async function requestFederationRpc<T>(method: string, payload: unknown): Promise<T> {
  const mgr = getFederationManager();
  if (!mgr?.satelliteClient?.isHubTrusted()) {
    throw new Error("HUB_UNAVAILABLE");
  }
  if (!transport) throw new Error("HUB_UNAVAILABLE");

  const request_id = randomPublicId();
  const send = transport.sendRaw;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(request_id);
      reject(new Error("federation rpc timeout"));
    }, REQUEST_TIMEOUT_MS);
    pending.set(request_id, {
      // 联邦结果 payload 由调用方契约约束；运行时无法静态证明 T
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- requestFederationRpc 泛型边界
      resolve: (p) => resolve(p as T),
      reject,
      timer,
    });
    send(
      encodeFederationFrame(method, {
        ...(typeof payload === "object" && payload != null ? payload : { value: payload }),
        request_id,
      }),
    );
  });
}

export function encodeFederationResult(
  requestMethod: string,
  requestId: string,
  result: unknown,
): string {
  return encodeFederationFrame(`${requestMethod}.result`, {
    request_id: requestId,
    result,
  });
}

export function encodeFederationError(
  requestMethod: string,
  requestId: string,
  error: string,
): string {
  return encodeFederationFrame(`${requestMethod}.error`, {
    request_id: requestId,
    error,
  });
}

export function extractRequestId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload == null) return null;
  const id = (payload as { request_id?: unknown }).request_id;
  return typeof id === "string" ? id : null;
}

export { parseFederationFrame };
