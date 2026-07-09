import { randomUUID } from "node:crypto";

import { resolveHubRpcWsUrl } from "@freeanima/shared/hub-rpc";
import { parseHubRpcEnvelope, serializeHubRpcEnvelope } from "@freeanima/shared/hub-rpc";

/** Hub RPC HTTP 传输：POST /hub/rpc/v1，body 为 HubRPC req envelope */
export function buildHubRpcHttpUrl(httpOrigin: string): string {
  const base = httpOrigin.replace(/\/$/, "");
  return `${base}/hub/rpc/v1`;
}

export function buildHubRpcHttpRequest(
  method: string,
  payload: unknown,
  authToken?: string,
): { url: string; init: RequestInit } {
  const id = randomUUID();
  const body = serializeHubRpcEnvelope({
    kind: "req",
    id,
    method,
    payload: payload ?? {},
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken?.trim()) {
    headers.Authorization = `Bearer ${authToken.trim()}`;
  }
  return {
    url: "",
    init: { method: "POST", headers, body },
  };
}

export async function parseHubRpcHttpResponse(
  res: Response,
  expectedId?: string,
): Promise<unknown> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const raw = await res.text();
  const envelope = parseHubRpcEnvelope(raw);
  if (envelope.kind !== "res") {
    throw new Error("expected Hub RPC res envelope");
  }
  if (expectedId !== undefined && envelope.id !== expectedId) {
    throw new Error("Hub RPC response id mismatch");
  }
  if (!envelope.ok) {
    throw new Error(envelope.error.message);
  }
  return envelope.payload;
}

export { resolveHubRpcWsUrl };
