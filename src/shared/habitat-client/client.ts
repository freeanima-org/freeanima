import {
  getHubMethodDef,
  isHubMethod,
  resolveDefaultTransport,
  resolveFallbackTransport,
  type HabitatClientProfile,
  type HubMethod,
  type HubMethodInputs,
  type HubMethodOutputs,
  type TransportKind,
} from "@freeanima/shared/habitat-contract";
import type { RpcClient } from "@freeanima/shared/habitat-rpc";
import {
  buildHabitatRestRequest,
  isNonJsonHabitatHttpMethod,
  parseHabitatRestResponse,
  throwHabitatRestError,
} from "@freeanima/shared/habitat-rpc";

export type HubCallOptions = {
  transport?: "auto" | TransportKind;
  profile?: HabitatClientProfile;
  signal?: AbortSignal;
};

export type HubCallRawOptions = HubCallOptions & {
  body?: BodyInit;
};

export type HabitatClientOptions = {
  httpOrigin: string;
  authToken?: string;
  fetch?: typeof fetch;
  getRpcClient: () => Promise<RpcClient>;
  profile?: HabitatClientProfile;
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

type ConditionalGetCacheEntry = { etag: string; body: unknown };

function conditionalGetCacheKey(method: string, payload: Record<string, unknown>): string {
  return `${method}\0${JSON.stringify(payload)}`;
}

export function createHabitatClient(options: HabitatClientOptions) {
  const profile = options.profile ?? "satellite";
  const httpFetch = options.fetch ?? globalThis.fetch;
  /** GET JSON 条件请求：同 method+payload 记忆 ETag 与正文 */
  const conditionalGetCache = new Map<string, ConditionalGetCacheEntry>();

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
    if (isNonJsonHabitatHttpMethod(method)) {
      throw new Error(`hub method ${method} requires callRaw() for non-JSON HTTP`);
    }
    const recordPayload = (payload ?? {}) as Record<string, unknown>;
    const cacheKey = conditionalGetCacheKey(method, recordPayload);
    const cached = conditionalGetCache.get(cacheKey);
    const { url, init } = buildHabitatRestRequest(
      options.httpOrigin,
      method,
      recordPayload,
      options.authToken,
      cached?.etag ? { ifNoneMatch: cached.etag } : undefined,
    );
    const res = await httpFetch(url, {
      ...init,
      ...(signal !== undefined ? { signal } : {}),
    });
    const def = getHubMethodDef(method);
    if (res.status === 304) {
      if (!cached) {
        throw new Error(`HTTP 304 Not Modified without local cache for ${method}`);
      }
      return def.output.parse(cached.body) as HubMethodOutputs[K];
    }
    const result = await parseHabitatRestResponse(res);
    const etag = res.headers.get("ETag");
    if (etag) {
      conditionalGetCache.set(cacheKey, { etag, body: result });
    }
    return def.output.parse(result) as HubMethodOutputs[K];
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

  async function callRaw<K extends HubMethod>(
    method: K,
    payload: HubMethodInputs[K],
    opts: HubCallRawOptions = {},
  ): Promise<Response> {
    if (!isHubMethod(method)) {
      throw new Error(`unknown hub method: ${method}`);
    }
    if (!isNonJsonHabitatHttpMethod(method)) {
      throw new Error(`hub method ${method} should use call() for JSON HTTP`);
    }
    const def = getHubMethodDef(method);
    def.input.parse(payload);

    const recordPayload = (payload ?? {}) as Record<string, unknown>;
    const { url, init } = buildHabitatRestRequest(
      options.httpOrigin,
      method,
      recordPayload,
      options.authToken,
      opts.body !== undefined ? { body: opts.body } : undefined,
    );
    const res = await httpFetch(url, {
      ...init,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });
    if (res.ok) return res;
    return throwHabitatRestError(res);
  }

  return { call, callRaw, callViaWs, callViaHttp };
}

export type HabitatClient = ReturnType<typeof createHabitatClient>;
