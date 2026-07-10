import { getHubMethodDef, type HubMethod } from "@freeanima/shared/hub-contract";

const HUB_RPC_REST_PREFIX = "/hub/rpc/v1";

export function hubRpcRestPrefix(): string {
  return HUB_RPC_REST_PREFIX;
}

/** 无 token 探活 URL */
export function hubHealthProbeUrl(httpOrigin: string): string {
  return `${normalizeOrigin(httpOrigin)}${HUB_RPC_REST_PREFIX}health/probe`;
}

/** TLS CA 信息 URL（无 token） */
export function hubTlsCaInfoUrl(httpOrigin: string): string {
  return `${normalizeOrigin(httpOrigin)}${HUB_RPC_REST_PREFIX}tls/ca/info`;
}

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

export function buildHubRestRequest(
  httpOrigin: string,
  method: HubMethod,
  payload: Record<string, unknown>,
  authToken?: string,
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

  const headers: Record<string, string> = {};
  if (authToken?.trim()) {
    headers.Authorization = `Bearer ${authToken.trim()}`;
  }

  if (http.verb === "GET") {
    appendPayloadToQuery(url.searchParams, payload, omitKeys);
    return { url: url.toString(), init: { method: "GET", headers } };
  }

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

export type HubRestErrorBody = {
  error: { code: string; message: string };
};

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
