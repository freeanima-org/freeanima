import type { HubMethodDef } from "../method-def.ts";
import {
  buildHttpRouteMeta,
  isReadOnlyHubMeta,
  resolveHttpRequestEncoding,
} from "../http-route.ts";
import { resolveHubAuthPolicy, type HttpRouteMeta } from "../transport.ts";

let methodRegistry: Record<string, HubMethodDef> = {};
let httpRouteRegistry: Partial<Record<string, HttpRouteMeta>> = {};
let installed = false;

function buildHttpRouteRegistry(
  registry: Record<string, HubMethodDef>,
): Partial<Record<string, HttpRouteMeta>> {
  const routeKeys = new Set<string>();
  const routes: Partial<Record<string, HttpRouteMeta>> = {};

  for (const method of Object.keys(registry)) {
    const def = registry[method];
    if (!def) continue;
    const meta = def.meta;
    if (!meta.transports.includes("http")) continue;

    const readOnly = isReadOnlyHubMeta(meta) || resolveHubAuthPolicy(meta) === "optional";
    const http = buildHttpRouteMeta(method, def.input, readOnly, meta.httpOverrides);
    if (resolveHubAuthPolicy(meta) === "optional" && meta.transports.includes("ws")) {
      throw new Error(`hub method ${method}: auth optional requires http-only transport`);
    }
    if (http.verb === "GET" && !readOnly && !meta.httpOverrides?.verb) {
      throw new Error(`hub method ${method}: GET route requires readOnly meta`);
    }
    const requestEncoding = resolveHttpRequestEncoding(http);
    if (requestEncoding !== "json" && http.verb !== "POST") {
      throw new Error(`hub method ${method}: non-json request requires POST verb`);
    }
    const routeKey = `${http.verb}:${http.path}`;
    if (routeKeys.has(routeKey)) {
      throw new Error(`duplicate hub http route: ${routeKey} (${method})`);
    }
    routeKeys.add(routeKey);
    routes[method] = http;
  }

  return routes;
}

/** Platform boot 时安装完整 method registry（运行时 SSOT） */
export function installHubMethodRegistry(registry: Record<string, HubMethodDef>): void {
  methodRegistry = { ...registry };
  httpRouteRegistry = buildHttpRouteRegistry(methodRegistry);
  installed = true;
}

export function isHubMethodRegistryInstalled(): boolean {
  return installed;
}

export function getInstalledMethodRegistry(): Readonly<Record<string, HubMethodDef>> {
  return methodRegistry;
}

export function getInstalledHttpRoute(method: string): HttpRouteMeta | undefined {
  return httpRouteRegistry[method];
}

export function listInstalledHubMethods(): string[] {
  return Object.keys(methodRegistry);
}

export function isInstalledHubMethod(method: string): boolean {
  return method in methodRegistry;
}

export function getInstalledHubMethodDef(method: string): HubMethodDef | undefined {
  const def = methodRegistry[method];
  if (!def) return undefined;
  const http = httpRouteRegistry[method];
  if (!http) return def;
  const { httpOverrides: _ignored, ...metaBase } = def.meta;
  return { ...def, meta: { ...metaBase, http } };
}

export function resetHubMethodRegistryForTests(): void {
  methodRegistry = {};
  httpRouteRegistry = {};
  installed = false;
}

/** 编译期类型占位；完整 union 见 @freeanima/platform/habitat/habitat-router */
export type RuntimeHubMethod = string;

export type RuntimeHubMethodInputs = Record<string, unknown>;

export type RuntimeHubMethodOutputs = unknown;
