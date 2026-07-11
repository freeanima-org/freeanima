import {
  getHubMethodDef,
  resolveHttpRequestEncoding,
  resolveHttpResponseEncoding,
} from "@freeanima/shared/hub-contract";

import { HUB_RPC_REST_PREFIX } from "./urls.ts";

export { hubRpcRestPrefix, hubHealthProbeUrl } from "./urls.ts";

function normalizeOrigin(httpOrigin: string): string {
  return httpOrigin.replace(/\/$/, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeQueryScalar(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

/** 将 payload 字段写入 URLSearchParams（标量 string；boolean；数组重复 key；对象 JSON） */
export function appendPayloadToQuery(
  params: URLSearchParams,
  payload: Record<string, unknown>,
  omitKeys: ReadonlySet<string>,
): void {
  for (const [key, value] of Object.entries(payload)) {
    if (omitKeys.has(key) || value === undefined) continue;
    if (value === null) {
      params.set(key, "");
      continue;
    }
    if (Array.isArray(value)) {
      const primitive = value.every(
        (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
      );
      if (primitive) {
        for (const item of value) {
          params.append(key, String(item));
        }
        continue;
      }
      params.set(key, JSON.stringify(value));
      continue;
    }
    if (typeof value === "boolean") {
      params.set(key, value ? "true" : "false");
      continue;
    }
    if (isPlainObject(value)) {
      params.set(key, JSON.stringify(value));
      continue;
    }
    params.set(key, String(value));
  }
}

/** 从 query string 解析 payload 字段（与 appendPayloadToQuery 对称） */
export function parseQueryToPayload(
  searchParams: URLSearchParams,
  omitKeys: ReadonlySet<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const key of searchParams.keys()) {
    if (omitKeys.has(key)) continue;
    const all = searchParams.getAll(key);
    if (all.length > 1) {
      payload[key] = all.map((raw) => decodeQueryScalar(raw));
      continue;
    }
    const raw = all[0];
    if (raw === undefined) continue;
    payload[key] = decodeQueryScalar(raw);
  }

  return payload;
}

function buildRestPath(
  httpPath: string,
  pathParams: readonly string[],
  payload: Record<string, unknown>,
): string {
  if (pathParams.length === 0) return httpPath;

  const segments = httpPath.split("/");
  for (const param of pathParams) {
    const value = payload[param];
    if (value === undefined || value === null) {
      throw new Error(`missing path param: ${param}`);
    }
    const idx = segments.findIndex((s) => s === `:${param}`);
    if (idx === -1) {
      throw new Error(`path pattern missing param :${param}`);
    }
    segments[idx] = encodeURIComponent(String(value));
  }
  return segments.join("/");
}

export type BuildHubRestRequestOptions = {
  body?: BodyInit;
};

export function hubRestUrl(
  httpOrigin: string,
  method: string,
  payload: Record<string, unknown>,
): string {
  return buildHubRestRequest(httpOrigin, method, payload).url;
}

export function buildHubRestRequest(
  httpOrigin: string,
  method: string,
  payload: Record<string, unknown>,
  authToken?: string,
  options?: BuildHubRestRequestOptions,
): { url: string; init: RequestInit } {
  const def = getHubMethodDef(method);
  const http = def.meta.http;
  if (!http) {
    throw new Error(`hub method ${method} has no HTTP REST route`);
  }

  const pathParams = http.pathParams ?? [];
  const omitKeys = new Set(pathParams);
  const restPath = buildRestPath(http.path, pathParams, payload);
  const url = new URL(`${normalizeOrigin(httpOrigin)}${HUB_RPC_REST_PREFIX}/${restPath}`);
  const requestEncoding = resolveHttpRequestEncoding(http);

  const headers: Record<string, string> = {};
  if (authToken?.trim()) {
    headers.Authorization = `Bearer ${authToken.trim()}`;
  }

  if (http.verb === "GET") {
    appendPayloadToQuery(url.searchParams, payload, omitKeys);
    return { url: url.toString(), init: { method: "GET", headers } };
  }

  if (requestEncoding === "json") {
    headers["Content-Type"] = "application/json";
    const bodyPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!omitKeys.has(key)) {
        bodyPayload[key] = value;
      }
    }
    return {
      url: url.toString(),
      init: { method: "POST", headers, body: JSON.stringify(bodyPayload) },
    };
  }

  if (
    requestEncoding === "multipart" &&
    options?.body !== undefined &&
    !(options.body instanceof FormData)
  ) {
    throw new Error(`hub method ${method} requires FormData body`);
  }

  const init: RequestInit = { method: "POST", headers };
  if (options?.body !== undefined) {
    init.body = options.body;
  }
  return { url: url.toString(), init };
}

export type HubRestErrorBody = {
  error: { code: string; message: string };
};

export async function throwHubRestError(res: Response): Promise<never> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as Partial<HubRestErrorBody>;
    const message = parsed.error?.message ?? (text || `HTTP ${res.status}`);
    throw new Error(message);
  } catch (e) {
    if (e instanceof Error && e.message !== text) throw e;
    throw new Error(text || `HTTP ${res.status}`, { cause: e });
  }
}

export async function fetchHubRestRaw(
  httpOrigin: string,
  method: string,
  payload: Record<string, unknown>,
  options?: {
    authToken?: string;
    body?: BodyInit;
    fetch?: typeof fetch;
    signal?: AbortSignal;
  },
): Promise<Response> {
  const { url, init } = buildHubRestRequest(
    httpOrigin,
    method,
    payload,
    options?.authToken,
    options?.body !== undefined ? { body: options.body } : undefined,
  );
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const res = await fetchFn(url, {
    ...init,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  if (res.ok) return res;
  return throwHubRestError(res);
}

export async function parseHubRestResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!res.ok) {
    const errBody = parsed as Partial<HubRestErrorBody>;
    const message =
      errBody?.error?.message ?? (typeof parsed === "string" ? parsed : `HTTP ${res.status}`);
    throw new Error(message);
  }

  return parsed;
}

/** TLS CA 信息 URL（无 token） */
export function hubTlsCaInfoUrl(httpOrigin: string): string {
  return hubRestUrl(httpOrigin, "tls.ca.info", {});
}

/** TLS CA PEM 下载 URL（无 token） */
export function hubTlsCaDownloadUrl(httpOrigin: string): string {
  return hubRestUrl(httpOrigin, "tls.ca", {});
}

export function isNonJsonHubHttpMethod(method: string): boolean {
  const http = getHubMethodDef(method).meta.http;
  if (!http) return false;
  return (
    resolveHttpRequestEncoding(http) !== "json" || resolveHttpResponseEncoding(http) !== "json"
  );
}
