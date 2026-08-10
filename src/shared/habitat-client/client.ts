import {
  getHabitatMethodDef,
  isHabitatMethod,
  isReadOnlyHabitatMeta,
  resolveDefaultTransport,
  resolveFallbackTransport,
  resolveHabitatAuthPolicy,
  type HabitatClientProfile,
  type HabitatMethod,
  type HabitatMethodInputs,
  type HabitatMethodMeta,
  type HabitatMethodOutputs,
  type TransportKind,
} from "@freeanima/shared/habitat-contract";
import type { RpcClient } from "@freeanima/shared/habitat-rpc";
import {
  buildHabitatRestRequest,
  HABITAT_RPC_READ_TIMEOUT_MS,
  HABITAT_RPC_WRITE_TIMEOUT_MS,
  isNonJsonHabitatHttpMethod,
  parseHabitatRestResponse,
  throwHabitatRestError,
} from "@freeanima/shared/habitat-rpc";

export type HabitatCallOptions = {
  transport?: "auto" | TransportKind;
  profile?: HabitatClientProfile;
  signal?: AbortSignal;
  /** WS/HTTP 请求超时；省略时用 method meta.timeoutMs，再按读 3s / 写 10s */
  timeoutMs?: number;
};

export type HabitatCallRawOptions = HabitatCallOptions & {
  body?: BodyInit;
};

export type HabitatClientOptions = {
  httpOrigin: string;
  authToken?: string;
  fetch?: typeof fetch;
  getRpcClient: () => Promise<RpcClient>;
  profile?: HabitatClientProfile;
};

export class HabitatTransportError extends Error {
  readonly transport: TransportKind;
  constructor(transport: TransportKind, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "HabitatTransportError";
    this.transport = transport;
  }
}

function isTransportFailure(err: unknown): boolean {
  if (err instanceof HabitatTransportError) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("websocket") ||
    msg.includes("not connected")
  );
}

function isReadMethod(method: HabitatMethod): boolean {
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

/** opts > meta.timeoutMs > 读/写档默认 */
function resolveCallTimeoutMs(optsTimeout: number | undefined, meta: HabitatMethodMeta): number {
  if (optsTimeout !== undefined) return optsTimeout;
  if (meta.timeoutMs !== undefined) return meta.timeoutMs;
  const readLike = isReadOnlyHabitatMeta(meta) || resolveHabitatAuthPolicy(meta) === "optional";
  return readLike ? HABITAT_RPC_READ_TIMEOUT_MS : HABITAT_RPC_WRITE_TIMEOUT_MS;
}

type ConditionalGetCacheEntry = { etag: string; body: unknown };

function conditionalGetCacheKey(method: string, payload: Record<string, unknown>): string {
  return `${method}\0${JSON.stringify(payload)}`;
}

export function createHabitatClient(options: HabitatClientOptions) {
  const profile = options.profile ?? "outpost";
  const httpFetch = options.fetch ?? globalThis.fetch;
  /** GET JSON 条件请求：同 method+payload 记忆 ETag 与正文 */
  const conditionalGetCache = new Map<string, ConditionalGetCacheEntry>();

  async function callViaWs<K extends HabitatMethod>(
    method: K,
    payload: HabitatMethodInputs[K],
    timeoutMs?: number,
  ): Promise<HabitatMethodOutputs[K]> {
    const rpc = await options.getRpcClient();
    return rpc.request(
      method,
      payload,
      timeoutMs !== undefined ? { timeoutMs } : undefined,
    ) as Promise<HabitatMethodOutputs[K]>;
  }

  async function callViaHttp<K extends HabitatMethod>(
    method: K,
    payload: HabitatMethodInputs[K],
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<HabitatMethodOutputs[K]> {
    if (isNonJsonHabitatHttpMethod(method)) {
      throw new Error(`habitat method ${method} requires callRaw() for non-JSON HTTP`);
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
    const timeoutSignal =
      signal == null && timeoutMs != null && timeoutMs > 0
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    const res = await httpFetch(url, {
      ...init,
      ...(signal !== undefined
        ? { signal }
        : timeoutSignal !== undefined
          ? { signal: timeoutSignal }
          : {}),
    });
    const def = getHabitatMethodDef(method);
    if (res.status === 304) {
      if (!cached) {
        throw new Error(`HTTP 304 Not Modified without local cache for ${method}`);
      }
      return def.output.parse(cached.body) as HabitatMethodOutputs[K];
    }
    const result = await parseHabitatRestResponse(res);
    const etag = res.headers.get("ETag");
    if (etag) {
      conditionalGetCache.set(cacheKey, { etag, body: result });
    }
    return def.output.parse(result) as HabitatMethodOutputs[K];
  }

  async function callOne<K extends HabitatMethod>(
    method: K,
    payload: HabitatMethodInputs[K],
    transport: TransportKind,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<HabitatMethodOutputs[K]> {
    try {
      if (transport === "ws") {
        return await callViaWs(method, payload, timeoutMs);
      }
      return await callViaHttp(method, payload, signal, timeoutMs);
    } catch (err) {
      throw transport === "ws"
        ? new HabitatTransportError("ws", err instanceof Error ? err.message : String(err), err)
        : new HabitatTransportError("http", err instanceof Error ? err.message : String(err), err);
    }
  }

  async function call<K extends HabitatMethod>(
    method: K,
    payload: HabitatMethodInputs[K],
    opts: HabitatCallOptions = {},
  ): Promise<HabitatMethodOutputs[K]> {
    if (!isHabitatMethod(method)) {
      throw new Error(`unknown habitat method: ${method}`);
    }
    const def = getHabitatMethodDef(method);
    def.input.parse(payload);

    const profileUsed = opts.profile ?? profile;
    let forced = opts.transport ?? "auto";
    if (forced === "auto") {
      forced = resolveDefaultTransport(def.meta, profileUsed);
    }
    if (!def.meta.transports.includes(forced)) {
      throw new Error(`transport ${forced} not allowed for ${method}`);
    }

    const timeoutMs = resolveCallTimeoutMs(opts.timeoutMs, def.meta);

    try {
      return await callOne(method, payload, forced, opts.signal, timeoutMs);
    } catch (primaryErr) {
      const canFallback =
        def.meta.fallback !== false &&
        isReadMethod(method) &&
        opts.transport !== "ws" &&
        opts.transport !== "http";
      const fallback = canFallback ? resolveFallbackTransport(def.meta, forced) : null;
      if (fallback && isTransportFailure(primaryErr)) {
        return callOne(method, payload, fallback, opts.signal, timeoutMs);
      }
      throw primaryErr;
    }
  }

  async function callRaw<K extends HabitatMethod>(
    method: K,
    payload: HabitatMethodInputs[K],
    opts: HabitatCallRawOptions = {},
  ): Promise<Response> {
    if (!isHabitatMethod(method)) {
      throw new Error(`unknown habitat method: ${method}`);
    }
    if (!isNonJsonHabitatHttpMethod(method)) {
      throw new Error(`habitat method ${method} should use call() for JSON HTTP`);
    }
    const def = getHabitatMethodDef(method);
    def.input.parse(payload);

    const timeoutMs = resolveCallTimeoutMs(opts.timeoutMs, def.meta);
    const timeoutSignal =
      opts.signal == null && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
    const signal =
      opts.signal !== undefined
        ? opts.signal
        : timeoutSignal !== undefined
          ? timeoutSignal
          : undefined;

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
      ...(signal !== undefined ? { signal } : {}),
    });
    if (res.ok) return res;
    return throwHabitatRestError(res);
  }

  return { call, callRaw, callViaWs, callViaHttp };
}

export type HabitatClient = ReturnType<typeof createHabitatClient>;
