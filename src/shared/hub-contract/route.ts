import type { z } from "zod";

import type { HubMethodDef } from "./method-def.ts";

/** 单条 Hub route：schema + meta + handler 同位 */
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

export function mergeFeatureRoutes(routes: readonly HubRouteBundle[]): FeatureRouteBundle {
  const handlers: FeatureRouteBundle["handlers"] = {};
  const defs: FeatureRouteBundle["defs"] = {};

  for (const route of routes) {
    if (handlers[route.method] !== undefined) {
      throw new Error(`duplicate hub route in feature bundle: ${route.method}`);
    }
    handlers[route.method] = route.handler as HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;
    defs[route.method] = route.def;
  }

  return { handlers, defs };
}

export function mergeHubRouteBundles(bundles: readonly FeatureRouteBundle[]): FeatureRouteBundle {
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

  return { handlers, defs };
}

/** 从 legacy registry defs + handler map 构建 feature routes（迁移辅助） */
export function attachHandlersToDefs<
  T extends Record<string, HubMethodDef>,
  H extends Record<keyof T & string, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>,
>(defs: T, handlers: H): FeatureRouteBundle {
  const routes: HubRouteBundle[] = [];
  for (const method of Object.keys(defs) as (keyof T & string)[]) {
    const def = defs[method];
    const handler = handlers[method];
    if (!def || !handler) {
      throw new Error(`missing handler or def for hub method: ${String(method)}`);
    }
    routes.push({
      method,
      def,
      handler,
    });
  }
  return mergeFeatureRoutes(routes);
}
