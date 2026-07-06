import type { z } from "zod";

import type { HubMethodMeta } from "./transport.ts";

/** 单个 Hub method 的契约定义 */
export type HubMethodDef<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  input: I;
  output: O;
  meta: HubMethodMeta;
};

export function defineHubMethod<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  def: HubMethodDef<I, O>,
): HubMethodDef<I, O> {
  return def;
}

/** dual CRUD：console 默认 http，satellite 默认 ws；读操作可 fallback */
export function dualCrudMeta(http: HubMethodMeta["http"], readOnly = true): HubMethodMeta {
  return {
    transports: ["http", "ws"],
    defaultByProfile: { console: "http", satellite: "ws" },
    fallback: readOnly,
    ...(http !== undefined ? { http } : {}),
  };
}

/** WS-only（流式 / 卫星 / terminal） */
export function wsOnlyMeta(): HubMethodMeta {
  return {
    transports: ["ws"],
    defaultByProfile: { console: "ws", satellite: "ws" },
    fallback: false,
  };
}

/** HTTP-only（Console 运维面） */
export function httpOnlyMeta(http: NonNullable<HubMethodMeta["http"]>): HubMethodMeta {
  return {
    transports: ["http"],
    defaultByProfile: { console: "http", satellite: "http" },
    fallback: false,
    http,
  };
}
