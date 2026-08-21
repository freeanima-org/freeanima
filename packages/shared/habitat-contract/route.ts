import type { z } from "zod";

import type { HabitatMethodDef } from "./method-def.ts";

/** Habitat / feature router 注入的 deps（组合根保证形状） */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- 调用方指定注入 deps 类型
export function asRouteDeps<T>(deps: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- router 注入 deps
  return deps as T;
}

/** Habitat / feature router 注入的 ctx（组合根保证形状） */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- 调用方指定注入 ctx 类型
export function asRouteCtx<T>(ctx: unknown): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- router 注入 ctx
  return ctx as T;
}

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

export type HabitatRouteHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = (
  deps: unknown,
  input: z.infer<I>,
  ctx: unknown,
) => Promise<z.infer<O>>;

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
    handlers[route.method] = route.handler;
    defs[route.method] = route.def;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mapped bundle 构造边界
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mapped bundle 构造边界
    handlers: handlers as RouteBundleHandlers<R>,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mapped bundle 构造边界
    defs: defs as RouteBundleDefs<R>,
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

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mapped bundle 构造边界
  return { handlers, defs } as MergedRouteBundle<B>;
}

/** 从已有 HabitatMethodDef（registry/schemas）绑定 handler，用于 Habitat UI 等大批量 method。
 * 入参保持 `z.infer<I>`；返回值放宽为 `Promise<unknown>`（Response / 具体 DTO / Record），
 * 由运行时 output schema 校验，避免大批量 handler 与 ZodRecord 输出不兼容。 */
export function defineHabitatRouteFromDef<
  M extends string,
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
>(
  method: M,
  def: HabitatMethodDef<I, O>,
  handler: (deps: unknown, input: z.infer<I>, ctx: unknown) => Promise<unknown>,
): HabitatRouteBundle<M, I, O> {
  return {
    method,
    def,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 返回值由 runtime output schema 校验
    handler: handler as HabitatRouteHandler<I, O>,
  };
}

type HabitatMethodDefMap = Readonly<Record<string, HabitatMethodDef>>;

/** 由 method-defs 推导各 method handler 的 input/output 类型 */
export type HabitatRouteHandlersForDefs<T extends HabitatMethodDefMap> = {
  [K in keyof T & string]: T[K] extends HabitatMethodDef<infer I, infer O>
    ? HabitatRouteHandler<I, O>
    : never;
};

/** 将 feature method-defs（SSOT）与 handler 绑定，供 habitat routes 与 client registry 复用同一份 def */
export function bindHabitatRouteHandlers<const T extends HabitatMethodDefMap>(
  defs: T,
  handlers: HabitatRouteHandlersForDefs<T>,
): { handlers: HabitatRouteHandlersForDefs<T>; defs: T } {
  const outHandlers: FeatureRouteBundle["handlers"] = {};
  const outDefs: FeatureRouteBundle["defs"] = {};
  for (const method of Object.keys(defs)) {
    const def = defs[method];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys 擦除 keyof
    const typedMethod = method as keyof T & string;
    const handler = handlers[typedMethod];
    if (!def) throw new Error(`missing habitat route def for ${method}`);
    if (!handler) throw new Error(`missing habitat route handler for ${method}`);
    outHandlers[method] = handler;
    outDefs[method] = def;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mapped bundle 构造边界
  return { handlers: outHandlers, defs: outDefs } as {
    handlers: HabitatRouteHandlersForDefs<T>;
    defs: T;
  };
}

// re-export for type-only consumers that still import HabitatMethodDef via route
export type { HabitatMethodDef };
