import type { HabitatMethodDef } from "../method-def.ts";
import {
  buildHttpRouteMeta,
  isReadOnlyHabitatMeta,
  resolveHttpRequestEncoding,
  type HttpRouteMeta,
} from "../http-route.ts";
import { resolveHabitatAuthPolicy } from "../transport.ts";
import { habitatMethodDefs } from "./habitat.ts";
import { wsOnlyMethodDefs } from "./ws-only.ts";
import {
  getInstalledHabitatMethodDef,
  installHabitatMethodRegistry,
  isHabitatMethodRegistryInstalled,
  isInstalledHabitatMethod,
  listInstalledHabitatMethods,
  resetHabitatMethodRegistryForTests,
} from "./runtime.ts";

/**
 * 编译期 fallback defs（habitat / ws-only）。
 * Feature method defs SSOT：features habitat routes → platform habitat-router → runtime registry。
 */
export const STATIC_METHOD_REGISTRY = {
  ...wsOnlyMethodDefs,
  ...habitatMethodDefs,
} as const;

function buildStaticHttpRouteRegistry(): Partial<Record<HabitatMethod, HttpRouteMeta>> {
  const routeKeys = new Set<string>();
  const routes: Partial<Record<HabitatMethod, HttpRouteMeta>> = {};

  for (const method of Object.keys(STATIC_METHOD_REGISTRY) as StaticHabitatMethod[]) {
    const def = STATIC_METHOD_REGISTRY[method];
    const meta = def.meta;
    if (!meta.transports.includes("http")) continue;

    const readOnly = isReadOnlyHabitatMeta(meta) || resolveHabitatAuthPolicy(meta) === "optional";
    const http = buildHttpRouteMeta(method, def.input, readOnly, meta.httpOverrides);
    if (resolveHabitatAuthPolicy(meta) === "optional" && meta.transports.includes("ws")) {
      throw new Error(`habitat method ${method}: auth optional requires http-only transport`);
    }
    if (http.verb === "GET" && !readOnly && !meta.httpOverrides?.verb) {
      throw new Error(`habitat method ${method}: GET route requires readOnly meta`);
    }
    const requestEncoding = resolveHttpRequestEncoding(http);
    if (requestEncoding !== "json" && http.verb !== "POST") {
      throw new Error(`habitat method ${method}: non-json request requires POST verb`);
    }
    const routeKey = `${http.verb}:${http.path}`;
    if (routeKeys.has(routeKey)) {
      throw new Error(`duplicate habitat http route: ${routeKey} (${method})`);
    }
    routeKeys.add(routeKey);
    routes[method] = http;
  }

  return routes;
}

const STATIC_HTTP_ROUTE_REGISTRY = buildStaticHttpRouteRegistry();

export type StaticHabitatMethod = keyof typeof STATIC_METHOD_REGISTRY;

export type HabitatMethod = string;

/** shared habitat-client 运行时 payload；精确类型见 @freeanima/host/platform/habitat */
export type HabitatMethodInputs = Record<string, unknown>;

/** shared habitat-client 运行时返回值；精确类型见 @freeanima/host/platform/habitat */
export type HabitatMethodOutputs = unknown;

export function isHabitatMethod(method: string): method is HabitatMethod {
  if (isHabitatMethodRegistryInstalled()) {
    return isInstalledHabitatMethod(method);
  }
  return method in STATIC_METHOD_REGISTRY;
}

export function getHabitatMethodDef(method: string): HabitatMethodDef {
  if (isHabitatMethodRegistryInstalled()) {
    const installed = getInstalledHabitatMethodDef(method);
    if (installed) return installed;
  }
  const def = STATIC_METHOD_REGISTRY[method as StaticHabitatMethod];
  if (!def) {
    throw new Error(
      `unknown habitat method: ${method} (install runtime registry via initHabitatRouter for feature methods)`,
    );
  }
  const http = STATIC_HTTP_ROUTE_REGISTRY[method as StaticHabitatMethod];
  if (!http) return def;
  const { httpOverrides: _ignored, ...metaBase } = def.meta;
  return { ...def, meta: { ...metaBase, http } };
}

export function getHabitatMethodHttpRoute(method: HabitatMethod): HttpRouteMeta | undefined {
  if (isHabitatMethodRegistryInstalled()) {
    return getInstalledHabitatMethodDef(method)?.meta.http;
  }
  return STATIC_HTTP_ROUTE_REGISTRY[method as StaticHabitatMethod];
}

export function listHabitatMethods(): HabitatMethod[] {
  if (isHabitatMethodRegistryInstalled()) {
    return listInstalledHabitatMethods();
  }
  return Object.keys(STATIC_METHOD_REGISTRY);
}

export {
  installHabitatMethodRegistry,
  resetHabitatMethodRegistryForTests,
  isHabitatMethodRegistryInstalled,
};
