import type { HabitatMethodDef } from "../method-def.ts";
import {
  buildHttpRouteMeta,
  isReadOnlyHabitatMeta,
  resolveHttpRequestEncoding,
} from "../http-route.ts";
import { resolveHabitatAuthPolicy, type HttpRouteMeta } from "../transport.ts";

let methodRegistry: Record<string, HabitatMethodDef> = {};
let httpRouteRegistry: Partial<Record<string, HttpRouteMeta>> = {};
let installed = false;

function buildHttpRouteRegistry(
  registry: Record<string, HabitatMethodDef>,
): Partial<Record<string, HttpRouteMeta>> {
  const routeKeys = new Set<string>();
  const routes: Partial<Record<string, HttpRouteMeta>> = {};

  for (const method of Object.keys(registry)) {
    const def = registry[method];
    if (!def) continue;
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

/** Platform boot 时安装完整 method registry（运行时 SSOT） */
export function installHabitatMethodRegistry(registry: Record<string, HabitatMethodDef>): void {
  methodRegistry = { ...registry };
  httpRouteRegistry = buildHttpRouteRegistry(methodRegistry);
  installed = true;
}

export function isHabitatMethodRegistryInstalled(): boolean {
  return installed;
}

export function getInstalledMethodRegistry(): Readonly<Record<string, HabitatMethodDef>> {
  return methodRegistry;
}

export function getInstalledHttpRoute(method: string): HttpRouteMeta | undefined {
  return httpRouteRegistry[method];
}

export function listInstalledHabitatMethods(): string[] {
  return Object.keys(methodRegistry);
}

export function isInstalledHabitatMethod(method: string): boolean {
  return method in methodRegistry;
}

export function getInstalledHabitatMethodDef(method: string): HabitatMethodDef | undefined {
  const def = methodRegistry[method];
  if (!def) return undefined;
  const http = httpRouteRegistry[method];
  if (!http) return def;
  const { httpOverrides: _ignored, ...metaBase } = def.meta;
  return { ...def, meta: { ...metaBase, http } };
}

export function resetHabitatMethodRegistryForTests(): void {
  methodRegistry = {};
  httpRouteRegistry = {};
  installed = false;
}

/** 编译期类型占位；完整 union 见 @freeanima/habitat/platform/habitat/habitat-router */
export type RuntimeHabitatMethod = string;

export type RuntimeHabitatMethodInputs = Record<string, unknown>;

export type RuntimeHabitatMethodOutputs = unknown;
