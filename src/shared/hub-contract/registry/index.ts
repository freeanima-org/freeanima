import type { z } from "zod";

import { buildHttpRouteMeta, isReadOnlyHubMeta, type HttpRouteMeta } from "../http-route.ts";
import { resolveHubAuthPolicy } from "../transport.ts";
import { chatMethodDefs } from "./chat.ts";
import { consoleMethodDefs } from "./console.ts";
import {
  diaryMethodDefs,
  dreamMethodDefs,
  emailMethodDefs,
  notificationMethodDefs,
  companionMethodDefs,
  pomodoroMethodDefs,
} from "./features.ts";
import { mcpMethodDefs } from "./mcp.ts";
import { taskMethodDefs } from "./task.ts";
import { projectMethodDefs } from "./project.ts";
import { vaultMethodDefs } from "./vault.ts";
import { wsOnlyMethodDefs } from "./ws-only.ts";
import type { HubMethodDef } from "../method-def.ts";

const REGISTRY_PARTS = [
  chatMethodDefs,
  taskMethodDefs,
  projectMethodDefs,
  vaultMethodDefs,
  emailMethodDefs,
  diaryMethodDefs,
  dreamMethodDefs,
  pomodoroMethodDefs,
  notificationMethodDefs,
  companionMethodDefs,
  wsOnlyMethodDefs,
  mcpMethodDefs,
  consoleMethodDefs,
] as const;

function assertNoDuplicateRegistry(): void {
  const seen = new Set<string>();
  for (const part of REGISTRY_PARTS) {
    for (const method of Object.keys(part)) {
      if (seen.has(method)) {
        throw new Error(`duplicate hub method registry entry: ${method}`);
      }
      seen.add(method);
    }
  }
}

assertNoDuplicateRegistry();

export const METHOD_REGISTRY = {
  ...chatMethodDefs,
  ...taskMethodDefs,
  ...projectMethodDefs,
  ...vaultMethodDefs,
  ...emailMethodDefs,
  ...diaryMethodDefs,
  ...dreamMethodDefs,
  ...pomodoroMethodDefs,
  ...notificationMethodDefs,
  ...companionMethodDefs,
  ...wsOnlyMethodDefs,
  ...mcpMethodDefs,
  ...consoleMethodDefs,
} as const;

function buildHttpRouteRegistry(): Partial<Record<HubMethod, HttpRouteMeta>> {
  const routeKeys = new Set<string>();
  const routes: Partial<Record<HubMethod, HttpRouteMeta>> = {};

  for (const method of Object.keys(METHOD_REGISTRY) as HubMethod[]) {
    const def = METHOD_REGISTRY[method];
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
    const routeKey = `${http.verb}:${http.path}`;
    if (routeKeys.has(routeKey)) {
      throw new Error(`duplicate hub http route: ${routeKey} (${method})`);
    }
    routeKeys.add(routeKey);
    routes[method] = http;
  }

  return routes;
}

const HTTP_ROUTE_REGISTRY = buildHttpRouteRegistry();

export function getHubMethodHttpRoute(method: HubMethod): HttpRouteMeta | undefined {
  return HTTP_ROUTE_REGISTRY[method];
}

export type HubMethod = keyof typeof METHOD_REGISTRY;

export type HubMethodInputs = {
  [K in HubMethod]: z.infer<(typeof METHOD_REGISTRY)[K]["input"]>;
};

export type HubMethodOutputs = {
  [K in HubMethod]: z.infer<(typeof METHOD_REGISTRY)[K]["output"]>;
};

export function isHubMethod(method: string): method is HubMethod {
  return method in METHOD_REGISTRY;
}

export function getHubMethodDef(method: HubMethod): HubMethodDef {
  const def = METHOD_REGISTRY[method];
  const http = HTTP_ROUTE_REGISTRY[method];
  if (!http) return def;
  const { httpOverrides: _ignored, ...metaBase } = def.meta;
  return { ...def, meta: { ...metaBase, http } };
}

export function listHubMethods(): HubMethod[] {
  return Object.keys(METHOD_REGISTRY) as HubMethod[];
}
