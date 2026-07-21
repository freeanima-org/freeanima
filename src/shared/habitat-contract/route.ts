import type { z } from "zod";

import type { HabitatMethodDef, HubMethodDef } from "./method-def.ts";

/** 单条 Habitat route：schema + meta + handler 同位 */
export type HabitatRouteBundle<
  M extends string = string,
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  method: M;
  def: HabitatMethodDef<I, O>;
  handler: HabitatRouteHandler<I, O>;
};

/** @deprecated 0.9.3 后删除 — 请用 HabitatRouteBundle */
export type HubRouteBundle<
  M extends string = string,
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = HabitatRouteBundle<M, I, O>;

export type HabitatRouteHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = (
  deps: unknown,
  input: z.infer<I>,
  ctx: unknown,
) => Promise<z.infer<O>>;

/** @deprecated 0.9.3 后删除 — 请用 HabitatRouteHandler */
export type HubRouteHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = HabitatRouteHandler<
  I,
  O
>;

export type FeatureRouteBundle = {
  handlers: Record<string, HabitatRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>;
  defs: Record<string, HabitatMethodDef>;
};

type RouteBundleDefs<R extends readonly HabitatRouteBundle[]> = {
  [K in R[number]["method"]]: Extract<R[number], { method: K }>["def"];
};

type RouteBundleHandlers<R extends readonly HabitatRouteBundle[]> = {
  [K in R[number]["method"]]: Extract<R[number], { method: K }>["handler"];
};

export type MergedRouteBundle<B extends readonly FeatureRouteBundle[]> = B extends readonly [
  infer H extends FeatureRouteBundle,
  ...infer T extends readonly FeatureRouteBundle[],
]
  ? {
      handlers: H["handlers"] & MergedRouteBundle<T>["handlers"];
      defs: H["defs"] & MergedRouteBundle<T>["defs"];
    }
  : { handlers: Record<string, never>; defs: Record<string, never> };

export function defineHabitatRoute<
  const M extends string,
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
>(def: {
  method: M;
  input: I;
  output: O;
  meta: HabitatMethodDef<I, O>["meta"];
  handler: HabitatRouteHandler<I, O>;
}): HabitatRouteBundle<M, I, O> {
  return {
    method: def.method,
    def: {
      input: def.input,
      output: def.output,
      meta: def.meta,
    },
    handler: def.handler,
  };
}

/** @deprecated 0.9.3 后删除 — 请用 defineHabitatRoute */
export const defineHubRoute = defineHabitatRoute;

export function mergeFeatureRoutes<const R extends readonly HabitatRouteBundle[]>(
  routes: R,
): {
  handlers: RouteBundleHandlers<R>;
  defs: RouteBundleDefs<R>;
} {
  const handlers: FeatureRouteBundle["handlers"] = {};
  const defs: FeatureRouteBundle["defs"] = {};

  for (const route of routes) {
    if (handlers[route.method] !== undefined) {
      throw new Error(`duplicate habitat route in feature bundle: ${route.method}`);
    }
    handlers[route.method] = route.handler as HabitatRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;
    defs[route.method] = route.def;
  }

  return { handlers, defs } as {
    handlers: RouteBundleHandlers<R>;
    defs: RouteBundleDefs<R>;
  };
}

export function mergeHabitatRouteBundles<const B extends readonly FeatureRouteBundle[]>(
  bundles: B,
): MergedRouteBundle<B> {
  const handlers: FeatureRouteBundle["handlers"] = {};
  const defs: FeatureRouteBundle["defs"] = {};

  for (const bundle of bundles) {
    for (const [method, handler] of Object.entries(bundle.handlers)) {
      if (handlers[method] !== undefined) {
        throw new Error(`duplicate habitat route handler: ${method}`);
      }
      handlers[method] = handler;
    }
    for (const [method, def] of Object.entries(bundle.defs)) {
      if (defs[method] !== undefined) {
        throw new Error(`duplicate habitat route def: ${method}`);
      }
      defs[method] = def;
    }
  }

  return { handlers, defs } as MergedRouteBundle<B>;
}

/** @deprecated 0.9.3 后删除 — 请用 mergeHabitatRouteBundles */
export const mergeHubRouteBundles = mergeHabitatRouteBundles;

/** 从已有 HabitatMethodDef（registry/schemas）绑定 handler，用于 Habitat UI 等大批量 method */
export function defineHabitatRouteFromDef<M extends string>(
  method: M,
  def: HabitatMethodDef,
  handler: HabitatRouteHandler<z.ZodTypeAny, z.ZodTypeAny>,
): HabitatRouteBundle<M, z.ZodTypeAny, z.ZodTypeAny> {
  return {
    method,
    def,
    handler,
  };
}

/** @deprecated 0.9.3 后删除 — 请用 defineHabitatRouteFromDef */
export const defineHubRouteFromDef = defineHabitatRouteFromDef;

type HabitatMethodDefMap = Readonly<Record<string, HabitatMethodDef>>;

/** 由 method-defs 推导各 method handler 的 input/output 类型 */
export type HabitatRouteHandlersForDefs<T extends HabitatMethodDefMap> = {
  [K in keyof T & string]: T[K] extends HabitatMethodDef<infer I, infer O>
    ? HabitatRouteHandler<I, O>
    : never;
};

/** @deprecated 0.9.3 后删除 — 请用 HabitatRouteHandlersForDefs */
export type HubRouteHandlersForDefs<T extends HabitatMethodDefMap> = HabitatRouteHandlersForDefs<T>;

/** 将 feature method-defs（SSOT）与 handler 绑定，供 habitat routes 与 client registry 复用同一份 def */
export function bindHabitatRouteHandlers<const T extends HabitatMethodDefMap>(
  defs: T,
  handlers: HabitatRouteHandlersForDefs<T>,
): { handlers: HabitatRouteHandlersForDefs<T>; defs: T } {
  const outHandlers: FeatureRouteBundle["handlers"] = {};
  const outDefs: FeatureRouteBundle["defs"] = {};
  for (const method of Object.keys(defs)) {
    const def = defs[method];
    const handler = handlers[method as keyof T & string];
    if (!def) throw new Error(`missing habitat route def for ${method}`);
    if (!handler) throw new Error(`missing habitat route handler for ${method}`);
    outHandlers[method] = handler as HabitatRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;
    outDefs[method] = def;
  }
  return { handlers: outHandlers, defs: outDefs } as {
    handlers: HabitatRouteHandlersForDefs<T>;
    defs: T;
  };
}

/** @deprecated 0.9.3 后删除 — 请用 bindHabitatRouteHandlers */
export const bindHubRouteHandlers = bindHabitatRouteHandlers;

// re-export for type-only consumers that still import HubMethodDef via route
export type { HubMethodDef };
