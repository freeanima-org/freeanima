import type { z } from "zod";

import type { HubMethodDef } from "./method-def.ts";

/** 单条 Habitat route：schema + meta + handler 同位 */
export type HubRouteBundle<
  M extends string = string,
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  method: M;
  def: HubMethodDef<I, O>;
  handler: HubRouteHandler<I, O>;
};

export type HubRouteHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = (
  deps: unknown,
  input: z.infer<I>,
  ctx: unknown,
) => Promise<z.infer<O>>;

export type FeatureRouteBundle = {
  handlers: Record<string, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>;
  defs: Record<string, HubMethodDef>;
};

type RouteBundleDefs<R extends readonly HubRouteBundle[]> = {
  [K in R[number]["method"]]: Extract<R[number], { method: K }>["def"];
};

type RouteBundleHandlers<R extends readonly HubRouteBundle[]> = {
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

export function defineHubRoute<
  const M extends string,
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
>(def: {
  method: M;
  input: I;
  output: O;
  meta: HubMethodDef<I, O>["meta"];
  handler: HubRouteHandler<I, O>;
}): HubRouteBundle<M, I, O> {
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

export function mergeFeatureRoutes<const R extends readonly HubRouteBundle[]>(
  routes: R,
): {
  handlers: RouteBundleHandlers<R>;
  defs: RouteBundleDefs<R>;
} {
  const handlers: FeatureRouteBundle["handlers"] = {};
  const defs: FeatureRouteBundle["defs"] = {};

  for (const route of routes) {
    if (handlers[route.method] !== undefined) {
      throw new Error(`duplicate hub route in feature bundle: ${route.method}`);
    }
    handlers[route.method] = route.handler as HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;
    defs[route.method] = route.def;
  }

  return { handlers, defs } as {
    handlers: RouteBundleHandlers<R>;
    defs: RouteBundleDefs<R>;
  };
}

export function mergeHubRouteBundles<const B extends readonly FeatureRouteBundle[]>(
  bundles: B,
): MergedRouteBundle<B> {
  const handlers: FeatureRouteBundle["handlers"] = {};
  const defs: FeatureRouteBundle["defs"] = {};

  for (const bundle of bundles) {
    for (const [method, handler] of Object.entries(bundle.handlers)) {
      if (handlers[method] !== undefined) {
        throw new Error(`duplicate hub route handler: ${method}`);
      }
      handlers[method] = handler;
    }
    for (const [method, def] of Object.entries(bundle.defs)) {
      if (defs[method] !== undefined) {
        throw new Error(`duplicate hub route def: ${method}`);
      }
      defs[method] = def;
    }
  }

  return { handlers, defs } as MergedRouteBundle<B>;
}

/** 从已有 HubMethodDef（registry/schemas）绑定 handler，用于 console 等大批量 method */
export function defineHubRouteFromDef<M extends string>(
  method: M,
  def: HubMethodDef,
  handler: HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>,
): HubRouteBundle<M, z.ZodTypeAny, z.ZodTypeAny> {
  return {
    method,
    def,
    handler,
  };
}

type HubMethodDefMap = Readonly<Record<string, HubMethodDef>>;

/** 由 method-defs 推导各 method handler 的 input/output 类型 */
export type HubRouteHandlersForDefs<T extends HubMethodDefMap> = {
  [K in keyof T & string]: T[K] extends HubMethodDef<infer I, infer O>
    ? HubRouteHandler<I, O>
    : never;
};

/** 将 feature method-defs（SSOT）与 handler 绑定，供 hub routes 与 client registry 复用同一份 def */
export function bindHubRouteHandlers<const T extends HubMethodDefMap>(
  defs: T,
  handlers: HubRouteHandlersForDefs<T>,
): { handlers: HubRouteHandlersForDefs<T>; defs: T } {
  const outHandlers: FeatureRouteBundle["handlers"] = {};
  const outDefs: FeatureRouteBundle["defs"] = {};
  for (const method of Object.keys(defs)) {
    const def = defs[method];
    const handler = handlers[method as keyof T & string];
    if (!def) throw new Error(`missing hub route def for ${method}`);
    if (!handler) throw new Error(`missing hub route handler for ${method}`);
    outHandlers[method] = handler as HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;
    outDefs[method] = def;
  }
  return { handlers: outHandlers, defs: outDefs } as {
    handlers: HubRouteHandlersForDefs<T>;
    defs: T;
  };
}
