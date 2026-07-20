import type { HubMethodDef } from "../method-def.ts";
import {
  buildHttpRouteMeta,
  isReadOnlyHubMeta,
  resolveHttpRequestEncoding,
  type HttpRouteMeta,
} from "../http-route.ts";
import { resolveHubAuthPolicy } from "../transport.ts";
import { habitatMethodDefs } from "./habitat.ts";
import { wsOnlyMethodDefs } from "./ws-only.ts";
import {
  getInstalledHubMethodDef,
  installHubMethodRegistry,
  isHubMethodRegistryInstalled,
  isInstalledHubMethod,
  listInstalledHubMethods,
  resetHubMethodRegistryForTests,
} from "./runtime.ts";

/**
 * 编译期 fallback defs（habitat / ws-only）。
 * Feature method defs SSOT：features hub routes → platform hub-router → runtime registry。
 */
export const STATIC_METHOD_REGISTRY = {
  ...wsOnlyMethodDefs,
  ...habitatMethodDefs,
} as const;

/** @deprecated 使用 getInstalledHubMethodDef；保留别名供过渡期 import */
export const METHOD_REGISTRY = STATIC_METHOD_REGISTRY;

function buildStaticHttpRouteRegistry(): Partial<Record<HubMethod, HttpRouteMeta>> {
  const routeKeys = new Set<string>();
  const routes: Partial<Record<HubMethod, HttpRouteMeta>> = {};

  for (const method of Object.keys(STATIC_METHOD_REGISTRY) as StaticHubMethod[]) {
    const def = STATIC_METHOD_REGISTRY[method];
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

const STATIC_HTTP_ROUTE_REGISTRY = buildStaticHttpRouteRegistry();

export type StaticHubMethod = keyof typeof STATIC_METHOD_REGISTRY;

export type HubMethod = string;

/** shared habitat-client 运行时 payload；精确类型见 @freeanima/platform/habitat */
export type HubMethodInputs = Record<string, unknown>;

/** shared habitat-client 运行时返回值；精确类型见 @freeanima/platform/habitat */
export type HubMethodOutputs = unknown;

export function isHubMethod(method: string): method is HubMethod {
  if (isHubMethodRegistryInstalled()) {
    return isInstalledHubMethod(method);
  }
  return method in STATIC_METHOD_REGISTRY;
}

export function getHubMethodDef(method: string): HubMethodDef {
  if (isHubMethodRegistryInstalled()) {
    const installed = getInstalledHubMethodDef(method);
    if (installed) return installed;
  }
  const def = STATIC_METHOD_REGISTRY[method as StaticHubMethod];
  if (!def) {
    throw new Error(
      `unknown hub method: ${method} (install runtime registry via initHubRouter for feature methods)`,
    );
  }
  const http = STATIC_HTTP_ROUTE_REGISTRY[method as StaticHubMethod];
  if (!http) return def;
  const { httpOverrides: _ignored, ...metaBase } = def.meta;
  return { ...def, meta: { ...metaBase, http } };
}

export function getHubMethodHttpRoute(method: HubMethod): HttpRouteMeta | undefined {
  if (isHubMethodRegistryInstalled()) {
    return getInstalledHubMethodDef(method)?.meta.http;
  }
  return STATIC_HTTP_ROUTE_REGISTRY[method as StaticHubMethod];
}

export function listHubMethods(): HubMethod[] {
  if (isHubMethodRegistryInstalled()) {
    return listInstalledHubMethods() as HubMethod[];
  }
  return Object.keys(STATIC_METHOD_REGISTRY) as HubMethod[];
}

export { installHubMethodRegistry, resetHubMethodRegistryForTests, isHubMethodRegistryInstalled };
