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

/** HTTP + WS 双传输（HubRPC envelope；无 REST path） */
export function dualTransportMeta(readOnly = true): HubMethodMeta {
  return {
    transports: ["http", "ws"],
    defaultByProfile: { console: "ws", satellite: "ws" },
    fallback: readOnly,
  };
}

/** 仅 HTTP 传输（HubRPC POST /hub/rpc/v1） */
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

/** @deprecated 使用 dualTransportMeta */
export function dualCrudMeta(_http?: unknown, readOnly = true): HubMethodMeta {
  return dualTransportMeta(readOnly);
}

/** @deprecated 使用 dualTransportMeta 或 httpTransportMeta */
export function httpOnlyMeta(_http?: unknown): HubMethodMeta {
  return dualTransportMeta(true);
}
