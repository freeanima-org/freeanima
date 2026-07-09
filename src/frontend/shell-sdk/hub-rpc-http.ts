import { randomUuid } from "@freeanima/kernel/random-uuid.ts";
import { parseHubRpcEnvelope, serializeHubRpcEnvelope } from "@freeanima/shared/hub-rpc";

export type HubRpcHttpCallOptions = {
  hubUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export async function hubRpcHttpCall<T>(
  method: string,
  payload: Record<string, unknown> = {},
  options: HubRpcHttpCallOptions,
): Promise<T> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const id = randomUuid();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const hubUrl = options.hubUrl.replace(/\/$/, "");
  const res = await fetchFn(`${hubUrl}/hub/rpc/v1`, {
    method: "POST",
    headers,
    body: serializeHubRpcEnvelope({
      kind: "req",
      id,
      method,
      payload,
    }),
  });
  if (!res.ok) {
    throw new Error(`Hub RPC ${method} failed: HTTP ${res.status}`);
  }
  const envelope = parseHubRpcEnvelope(await res.text());
  if (envelope.kind !== "res" || envelope.id !== id) {
    throw new Error(`Hub RPC ${method} invalid envelope`);
  }
  if (!envelope.ok) {
    throw new Error(envelope.error.message);
  }
  return envelope.payload as T;
}
