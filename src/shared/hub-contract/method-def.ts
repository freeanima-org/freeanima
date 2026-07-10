import type { z } from "zod";

import type { HubMethodMeta } from "./transport.ts";
import type { HttpRouteMeta } from "./http-route.ts";

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

export type DualTransportMetaOptions = {
  http?: Partial<HttpRouteMeta>;
};

/** HTTP + WS 双传输（只读默认 HTTP GET；写入默认 WS） */
export function dualTransportMeta(
  readOnly = true,
  options?: DualTransportMetaOptions,
): HubMethodMeta {
  const meta: HubMethodMeta = {
    transports: ["http", "ws"],
    defaultByProfile: readOnly
      ? { console: "http", satellite: "http" }
      : { console: "ws", satellite: "ws" },
    fallback: readOnly,
  };
  if (options?.http) {
    meta.httpOverrides = options.http;
  }
  return meta;
}

/** 仅 HTTP 传输（REST /hub/rpc/v1/{path}） */
export function httpTransportMeta(): HubMethodMeta {
  return {
    transports: ["http"],
    defaultByProfile: { console: "http", satellite: "http" },
    fallback: false,
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
