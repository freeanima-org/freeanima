import type { z } from "zod";

import type { HabitatMethodMeta } from "./transport.ts";
import type { HttpRouteMeta, HttpRequestEncoding, HttpResponseEncoding } from "./http-route.ts";

/** 单个 Habitat method 的契约定义 */
export type HabitatMethodDef<
  I extends z.ZodTypeAny = z.ZodTypeAny,
  O extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  input: I;
  output: O;
  meta: HabitatMethodMeta;
};

export function defineHabitatMethod<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  def: HabitatMethodDef<I, O>,
): HabitatMethodDef<I, O> {
  return def;
}

export type DualTransportMetaOptions = {
  http?: Partial<HttpRouteMeta>;
};

/** HTTP + WS 双传输（只读默认 HTTP GET；写入默认 WS） */
export function dualTransportMeta(
  readOnly = true,
  options?: DualTransportMetaOptions,
): HabitatMethodMeta {
  const meta: HabitatMethodMeta = {
    transports: ["http", "ws"],
    defaultByProfile: readOnly
      ? { habitat: "http", outpost: "http" }
      : { habitat: "ws", outpost: "ws" },
    fallback: readOnly,
  };
  if (options?.http) {
    meta.httpOverrides = options.http;
  }
  return meta;
}

/** 仅 HTTP 传输（REST /rpc/v1/{path}） */
export function httpTransportMeta(): HabitatMethodMeta {
  return {
    transports: ["http"],
    defaultByProfile: { habitat: "http", outpost: "http" },
    fallback: false,
  };
}

/** WS-only（流式 / outpost / terminal） */
export function wsOnlyMeta(): HabitatMethodMeta {
  return {
    transports: ["ws"],
    defaultByProfile: { habitat: "ws", outpost: "ws" },
    fallback: false,
  };
}

/** 仅 HTTP + 匿名可访问（health / TLS CA 等基础设施探活） */
export function publicHttpMeta(): HabitatMethodMeta {
  return {
    transports: ["http"],
    defaultByProfile: { habitat: "http", outpost: "http" },
    fallback: false,
    auth: "optional",
  };
}

/** publicHttpMeta + raw Response 响应（TLS PEM/QR 等） */
export function rawPublicHttpMeta(): HabitatMethodMeta {
  return {
    ...publicHttpMeta(),
    httpOverrides: { response: "raw" },
  };
}

export type BinaryHttpMetaOptions = {
  verb: "GET" | "POST";
  path: string;
  pathParams?: readonly string[];
  request?: HttpRequestEncoding;
  response?: HttpResponseEncoding;
  auth?: HabitatMethodMeta["auth"];
};

/** 仅 HTTP + 非 JSON 请求/响应（companion 资产等） */
export function binaryHttpMeta(options: BinaryHttpMetaOptions): HabitatMethodMeta {
  const httpOverrides: Partial<HttpRouteMeta> = {
    verb: options.verb,
    path: options.path,
  };
  if (options.pathParams) httpOverrides.pathParams = options.pathParams;
  if (options.request) httpOverrides.request = options.request;
  if (options.response) httpOverrides.response = options.response;
  return {
    transports: ["http"],
    defaultByProfile: { habitat: "http", outpost: "http" },
    fallback: false,
    ...(options.auth !== undefined ? { auth: options.auth } : {}),
    httpOverrides,
  };
}
