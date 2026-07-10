import { z } from "zod";

import {
  getHubMethodDef,
  listHubMethods,
  coercePayloadForSchema,
  type HubMethod,
  type HttpRouteMeta,
} from "@freeanima/shared/hub-contract";
import { appendPayloadToQuery, parseQueryToPayload } from "@freeanima/shared/hub-rpc/http-rest.ts";
import type { SapRequestAuthContext, SapRequestContext } from "@freeanima/shared/sap-contract";

import { hubDispatch } from "./dispatch.ts";
import type { SapServerDeps } from "../sap/types.ts";

/** 与 console-api handlers/errors 对齐；platform 不依赖 feature-console */
class HubRestHandlerError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HubRestHandlerError";
    this.status = status;
    this.code = code;
  }
}

const HUB_RPC_REST_PREFIX = "/hub/rpc/v1/";

type RouteEntry = {
  hubMethod: HubMethod;
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
  for (const hubMethod of listHubMethods()) {
    const def = getHubMethodDef(hubMethod);
    if (!def.meta.transports.includes("http") || !def.meta.http) continue;
    routes[def.meta.http.verb].push({ hubMethod, http: def.meta.http });
  }
  for (const verb of ["GET", "POST"] as const) {
    routes[verb].sort((a, b) => routeSpecificity(b.http.path) - routeSpecificity(a.http.path));
  }
  return routes;
}

const COMPILED_ROUTES = compileHttpRoutes();

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

function hubRestRelativePath(pathname: string): string | null {
  if (!pathname.startsWith(HUB_RPC_REST_PREFIX)) return null;
  const rel = pathname.slice(HUB_RPC_REST_PREFIX.length);
  return rel.length > 0 ? rel : null;
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function ctxFor(
  auth: HttpHubRestAuth,
  req: Request,
): SapRequestContext & {
  app_id: string;
  instance_id: string;
  httpRequest: Request;
} {
  const authCtx: SapRequestAuthContext = auth ?? {
    token_id: 0,
    subject_id: 0,
    subject_type: "user",
    scopes: [],
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

export type HttpHubRestAuth = SapRequestAuthContext | null;

export async function handleHttpHubRestRequest(
  req: Request,
  deps: SapServerDeps,
  auth: HttpHubRestAuth,
): Promise<Response> {
  const verb = req.method;
  if (verb !== "GET" && verb !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const relativePath = hubRestRelativePath(new URL(req.url).pathname);
  if (relativePath === null) {
    return jsonError(404, "not_found", "Hub RPC REST path not found");
  }

  const match = findRoute(verb, relativePath);
  if (!match) {
    if (findRouteAnyVerb(relativePath)) {
      return new Response("Method Not Allowed", { status: 405 });
    }
    return jsonError(404, "not_found", "Hub RPC REST path not found");
  }

  const { entry, pathValues } = match;
  const pathParamSet = new Set(entry.http.pathParams ?? []);

  let bodyPayload: Record<string, unknown> = {};
  if (verb === "POST") {
    try {
      const raw = await req.text();
      bodyPayload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return jsonError(400, "invalid_json", "Invalid JSON body");
    }
  }

  const url = new URL(req.url);
  const queryPayload = parseQueryToPayload(url.searchParams, pathParamSet);

  const merged: Record<string, unknown> = {
    ...queryPayload,
    ...bodyPayload,
    ...pathValues,
  };

  const def = getHubMethodDef(entry.hubMethod);
  const coerced = coercePayloadForSchema(merged, def.input);

  try {
    const result = await hubDispatch(deps, entry.hubMethod, coerced, ctxFor(auth, req));
    if (result instanceof Response) {
      return result;
    }
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return jsonError(400, "invalid_input", e.message);
    }
    if (e instanceof HubRestHandlerError) {
      return jsonError(e.status, e.code, e.message);
    }
    const apiErr = e as { status?: number; message?: string; context?: { code?: string } };
    if (typeof apiErr.status === "number" && apiErr.message) {
      return jsonError(
        apiErr.status,
        typeof apiErr.context?.code === "string" ? apiErr.context.code : "hub_rpc_error",
        apiErr.message,
      );
    }
    console.error("[hub-rest] handler failed:", e);
    return jsonError(500, "hub_rpc_error", "Hub RPC request failed");
  }
}

/** 供测试：给定 method 与 payload 生成 REST URL（不发起请求） */
export function buildHubRestPathForTest(
  httpOrigin: string,
  method: HubMethod,
  payload: Record<string, unknown>,
): string {
  const def = getHubMethodDef(method);
  const http = def.meta.http;
  if (!http) throw new Error(`hub method ${method} has no HTTP REST route`);
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

  const url = new URL(`${httpOrigin.replace(/\/$/, "")}/hub/rpc/v1/${restPath}`);
  if (http.verb === "GET") {
    appendPayloadToQuery(url.searchParams, payload, omitKeys);
  }
  return url.toString();
}

export { COMPILED_ROUTES, findRoute, hubRestRelativePath, matchPattern };
