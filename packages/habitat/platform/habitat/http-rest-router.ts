import { z } from "zod";

import {
  getHabitatMethodDef,
  listHabitatMethods,
  coercePayloadForSchema,
  resolveHttpRequestEncoding,
  resolveHttpResponseEncoding,
  type HabitatMethod,
  type HttpRouteMeta,
} from "@freeanima/shared/habitat-contract";
import {
  appendPayloadToQuery,
  parseQueryToPayload,
} from "@freeanima/shared/habitat-rpc/http-rest.ts";
import { HABITAT_RPC_REST_PREFIX } from "@freeanima/shared/habitat-rpc/urls.ts";
import type {
  RpcRequestAuthContext,
  RemoteToolsRequestContext,
} from "@freeanima/shared/rpc-contract";

import { habitatDispatch, TokenAuthorizationError } from "./dispatch.ts";
import { jsonResponseWithConditionalGet } from "./http-conditional.ts";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types.ts";
import { asRecord, isRecord } from "@freeanima/shared/util";

/** 与 habitat-api handlers/errors 对齐；platform 不依赖 feature 内部 handler */
class HabitatRestHandlerError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HabitatRestHandlerError";
    this.status = status;
    this.code = code;
  }
}

const HABITAT_RPC_REST_PREFIX_SLASH = `${HABITAT_RPC_REST_PREFIX}/`;

type RouteEntry = {
  hubMethod: HabitatMethod;
  http: HttpRouteMeta;
};

type CompiledRoutes = {
  GET: RouteEntry[];
  POST: RouteEntry[];
};

function routeSpecificity(path: string): number {
  const parts = path.split("/");
  let score = parts.length * 10;
  for (const part of parts) {
    if (part.startsWith(":")) score += 1;
  }
  return score;
}

function compileHttpRoutes(): CompiledRoutes {
  const routes: CompiledRoutes = { GET: [], POST: [] };
  for (const hubMethod of listHabitatMethods()) {
    const def = getHabitatMethodDef(hubMethod);
    if (!def.meta.transports.includes("http") || !def.meta.http) continue;
    routes[def.meta.http.verb].push({ hubMethod, http: def.meta.http });
  }
  for (const verb of ["GET", "POST"] as const) {
    routes[verb].sort((a, b) => routeSpecificity(b.http.path) - routeSpecificity(a.http.path));
  }
  return routes;
}

let COMPILED_ROUTES: CompiledRoutes = compileHttpRoutes();

export function resetCompiledHttpRoutes(): void {
  COMPILED_ROUTES = { GET: [], POST: [] };
}

export function compileHttpRoutesFromRegistry(): void {
  COMPILED_ROUTES = compileHttpRoutes();
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter((s) => s.length > 0);
  const pathParts = path.split("/").filter((s) => s.length > 0);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const pv = pathParts[i];
    if (pp === undefined || pv === undefined) return null;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = decodeURIComponent(pv);
    } else if (pp !== pv) {
      return null;
    }
  }
  return params;
}

function findRoute(
  verb: "GET" | "POST",
  relativePath: string,
): { entry: RouteEntry; pathValues: Record<string, string> } | null {
  for (const entry of COMPILED_ROUTES[verb]) {
    const pathValues = matchPattern(entry.http.path, relativePath);
    if (pathValues !== null) {
      return { entry, pathValues };
    }
  }
  return null;
}

function findRouteAnyVerb(
  relativePath: string,
): { entry: RouteEntry; pathValues: Record<string, string> } | null {
  for (const verb of ["GET", "POST"] as const) {
    const match = findRoute(verb, relativePath);
    if (match) return match;
  }
  return null;
}

function habitatRestRelativePath(pathname: string): string | null {
  if (!pathname.startsWith(HABITAT_RPC_REST_PREFIX_SLASH)) return null;
  const rel = pathname.slice(HABITAT_RPC_REST_PREFIX_SLASH.length);
  return rel.length > 0 ? rel : null;
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** 将 handler 抛错映射为 REST JSON；导出供单测（与 WS 同样透传 Error.message） */
export function mapHabitatRestHandlerError(e: unknown): Response {
  if (e instanceof z.ZodError) {
    return jsonError(400, "invalid_input", e.message);
  }
  if (e instanceof TokenAuthorizationError) {
    return jsonError(e.httpStatus, e.code, e.message);
  }
  if (e instanceof HabitatRestHandlerError) {
    return jsonError(e.status, e.code, e.message);
  }
  const apiErr = isRecord(e) ? e : null;
  const status = typeof apiErr?.status === "number" ? apiErr.status : undefined;
  const message = typeof apiErr?.message === "string" ? apiErr.message : undefined;
  const context = asRecord(apiErr?.context);
  if (status != null && message) {
    return jsonError(
      status,
      typeof context?.code === "string" ? context.code : "habitat_rpc_error",
      message,
    );
  }
  console.error("[habitat-rest] handler failed:", e);
  const errCode =
    e instanceof Error && typeof apiErr?.code === "string" && apiErr.code.trim()
      ? apiErr.code
      : "habitat_rpc_error";
  const fallbackMessage =
    e instanceof Error && e.message.trim()
      ? e.message
      : typeof e === "string" && e.trim()
        ? e
        : "Habitat RPC request failed";
  const fallbackStatus = errCode === "object_storage_not_configured" ? 503 : 500;
  return jsonError(fallbackStatus, errCode, fallbackMessage);
}

function ctxFor(
  auth: HttpHubRestAuth,
  req: Request,
): RemoteToolsRequestContext & {
  app_id: string;
  instance_id: string;
  httpRequest: Request;
} {
  const authCtx: RpcRequestAuthContext = auth ?? {
    token_id: 0,
    subject_id: 0,
    subject_type: "user",
    authorization: { full: true },
  };
  return {
    app_id: "",
    instance_id: "",
    auth: authCtx,
    httpRequest: req,
    sendEvent() {
      /* stateless HTTP REST — no streaming evt */
    },
  };
}

export type HttpHubRestAuth = RpcRequestAuthContext | null;

export async function handleHttpHabitatRestRequest(
  req: Request,
  deps: RemoteToolsServerDeps,
  auth: HttpHubRestAuth,
): Promise<Response> {
  const verb = req.method;
  if (verb !== "GET" && verb !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const relativePath = habitatRestRelativePath(new URL(req.url).pathname);
  if (relativePath === null) {
    return jsonError(404, "not_found", "Habitat RPC REST path not found");
  }

  const match = findRoute(verb, relativePath);
  if (!match) {
    if (findRouteAnyVerb(relativePath)) {
      return new Response("Method Not Allowed", { status: 405 });
    }
    return jsonError(404, "not_found", "Habitat RPC REST path not found");
  }

  const { entry, pathValues } = match;
  const pathParamSet = new Set(entry.http.pathParams ?? []);
  const requestEncoding = resolveHttpRequestEncoding(entry.http);

  let bodyPayload: Record<string, unknown> = {};
  if (verb === "POST") {
    if (requestEncoding === "json") {
      try {
        const raw = await req.text();
        bodyPayload = raw ? (asRecord(JSON.parse(raw)) ?? {}) : {};
      } catch {
        return jsonError(400, "invalid_json", "Invalid JSON body");
      }
    }
    /* multipart / raw：body 由 handler 经 ctx.httpRequest 读取 */
  }

  const url = new URL(req.url);
  const queryPayload = parseQueryToPayload(url.searchParams, pathParamSet);

  const merged: Record<string, unknown> = {
    ...queryPayload,
    ...bodyPayload,
    ...pathValues,
  };

  const def = getHabitatMethodDef(entry.hubMethod);
  const coerced = coercePayloadForSchema(merged, def.input);
  const responseEncoding = resolveHttpResponseEncoding(entry.http);

  try {
    const result = await habitatDispatch(deps, entry.hubMethod, coerced, ctxFor(auth, req));
    if (responseEncoding === "raw") {
      if (!(result instanceof Response)) {
        return jsonError(
          500,
          "invalid_handler_response",
          "Habitat method with raw response must return Response",
        );
      }
      return result;
    }
    if (result instanceof Response) {
      return result;
    }
    if (verb === "GET") {
      return jsonResponseWithConditionalGet(req, JSON.stringify(result));
    }
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (e) {
    return mapHabitatRestHandlerError(e);
  }
}

/** 供测试：给定 method 与 payload 生成 REST URL（不发起请求） */
export function buildHabitatRestPathForTest(
  httpOrigin: string,
  method: HabitatMethod,
  payload: Record<string, unknown>,
): string {
  const def = getHabitatMethodDef(method);
  const http = def.meta.http;
  if (!http) throw new Error(`habitat method ${method} has no HTTP REST route`);
  const pathParams = http.pathParams ?? [];
  const omitKeys = new Set(pathParams);

  let restPath = http.path;
  if (pathParams.length > 0) {
    const segments = restPath.split("/");
    for (const param of pathParams) {
      const idx = segments.findIndex((s) => s === `:${param}`);
      if (idx !== -1) {
        segments[idx] = encodeURIComponent(String(payload[param]));
      }
    }
    restPath = segments.join("/");
  }

  const url = new URL(`${httpOrigin.replace(/\/$/, "")}${HABITAT_RPC_REST_PREFIX}/${restPath}`);
  if (http.verb === "GET") {
    appendPayloadToQuery(url.searchParams, payload, omitKeys);
  }
  return url.toString();
}

export { COMPILED_ROUTES, findRoute, habitatRestRelativePath, matchPattern };
