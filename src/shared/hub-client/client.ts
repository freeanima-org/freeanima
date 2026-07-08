import { randomUUID } from "node:crypto";

import {
  getHubMethodDef,
  isHubMethod,
  resolveDefaultTransport,
  resolveFallbackTransport,
  type HubClientProfile,
  type HubMethod,
  type HubMethodInputs,
  type HubMethodOutputs,
  type TransportKind,
} from "@freeanima/hub-contract";
import type { RpcClient } from "@freeanima/hub-rpc";
import { parseHubRpcEnvelope, serializeHubRpcEnvelope } from "@freeanima/hub-rpc";

import { buildHubRpcHttpUrl } from "./http-rpc.ts";

export type HubCallOptions = {
  transport?: "auto" | TransportKind;
  profile?: HubClientProfile;
  signal?: AbortSignal;
};

export type HubClientOptions = {
  httpOrigin: string;
  authToken?: string;
  fetch?: typeof fetch;
  getRpcClient: () => Promise<RpcClient>;
  profile?: HubClientProfile;
};

export class HubTransportError extends Error {
  readonly transport: TransportKind;
  constructor(transport: TransportKind, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "HubTransportError";
    this.transport = transport;
  }
}

function isTransportFailure(err: unknown): boolean {
  if (err instanceof HubTransportError) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("websocket") ||
    msg.includes("not connected")
  );
}

function isReadMethod(method: HubMethod): boolean {
  return (
    method.endsWith(".list") ||
    method.endsWith(".get") ||
    method.endsWith(".messages") ||
    method.endsWith(".search") ||
    method.endsWith(".status") ||
    method.endsWith(".commands") ||
    method.endsWith(".files") ||
    method.endsWith(".summary") ||
    method.endsWith(".config")
  );
}

export function createHubClient(options: HubClientOptions) {
  const profile = options.profile ?? "satellite";
  const httpFetch = options.fetch ?? globalThis.fetch;

  async function callViaWs<K extends HubMethod>(
    method: K,
    payload: HubMethodInputs[K],
  ): Promise<HubMethodOutputs[K]> {
    const rpc = await options.getRpcClient();
    return rpc.request(method, payload) as Promise<HubMethodOutputs[K]>;
  }

  async function callViaHttp<K extends HubMethod>(
    method: K,
    payload: HubMethodInputs[K],
    signal?: AbortSignal,
  ): Promise<HubMethodOutputs[K]> {
    const id = randomUUID();
    const url = buildHubRpcHttpUrl(options.httpOrigin);
    const body = serializeHubRpcEnvelope({
      kind: "req",
      id,
      method,
      payload: payload ?? {},
    });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.authToken?.trim()) {
      headers.Authorization = `Bearer ${options.authToken.trim()}`;
    }
    const res = await httpFetch(url, {
      method: "POST",
      headers,
      body,
      ...(signal !== undefined ? { signal } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    const raw = await res.text();
    const envelope = parseHubRpcEnvelope(raw);
    if (envelope.kind !== "res") {
      throw new Error("expected Hub RPC res envelope");
    }
    if (envelope.id !== id) {
      throw new Error("Hub RPC response id mismatch");
    }
    if (!envelope.ok) {
      throw new Error(envelope.error.message);
    }
    return envelope.payload as HubMethodOutputs[K];
  }

  async function callOne<K extends HubMethod>(
    method: K,
    payload: HubMethodInputs[K],
    transport: TransportKind,
    signal?: AbortSignal,
  ): Promise<HubMethodOutputs[K]> {
    try {
      if (transport === "ws") {
        return await callViaWs(method, payload);
      }
      return await callViaHttp(method, payload, signal);
    } catch (err) {
      throw transport === "ws"
        ? new HubTransportError("ws", err instanceof Error ? err.message : String(err), err)
        : new HubTransportError("http", err instanceof Error ? err.message : String(err), err);
    }
  }

  async function call<K extends HubMethod>(
    method: K,
    payload: HubMethodInputs[K],
    opts: HubCallOptions = {},
  ): Promise<HubMethodOutputs[K]> {
    if (!isHubMethod(method)) {
      throw new Error(`unknown hub method: ${method}`);
    }
    const def = getHubMethodDef(method);
    def.input.parse(payload);

    const profileUsed = opts.profile ?? profile;
    let forced = opts.transport ?? "auto";
    if (forced === "auto") {
      forced = resolveDefaultTransport(def.meta, profileUsed);
    }
    if (!def.meta.transports.includes(forced)) {
      throw new Error(`transport ${forced} not allowed for ${method}`);
    }

    try {
      return await callOne(method, payload, forced, opts.signal);
    } catch (primaryErr) {
      const canFallback =
        def.meta.fallback !== false &&
        isReadMethod(method) &&
        opts.transport !== "ws" &&
        opts.transport !== "http";
      const fallback = canFallback ? resolveFallbackTransport(def.meta, forced) : null;
      if (fallback && isTransportFailure(primaryErr)) {
        return callOne(method, payload, fallback, opts.signal);
      }
      throw primaryErr;
    }
  }

  return { call, callViaWs, callViaHttp };
}

export type HubClient = ReturnType<typeof createHubClient>;
