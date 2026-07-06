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

import { bodyForHttpMethod, buildHttpUrl } from "./http-path.ts";

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
  const http = getHubMethodDef(method).meta.http;
  if (http?.method === "GET") return true;
  return (
    method.endsWith(".list") ||
    method.endsWith(".get") ||
    method.endsWith(".messages") ||
    method.endsWith(".search") ||
    method.endsWith(".status") ||
    method.endsWith(".commands")
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
    const def = getHubMethodDef(method);
    const http = def.meta.http;
    if (!http) {
      throw new HubTransportError("http", `method ${method} has no HTTP binding`);
    }
    const inputRecord = payload as Record<string, unknown>;
    const url = buildHttpUrl(options.httpOrigin, http, inputRecord);
    const body = bodyForHttpMethod(http, inputRecord);
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (options.authToken?.trim()) {
      headers.Authorization = `Bearer ${options.authToken.trim()}`;
    }
    const res = await httpFetch(url, {
      method: http.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(signal !== undefined ? { signal } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    if (res.status === 204) {
      return undefined as HubMethodOutputs[K];
    }
    return (await res.json()) as HubMethodOutputs[K];
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
