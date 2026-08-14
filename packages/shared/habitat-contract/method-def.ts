import type { z } from "zod";

import type { HabitatMethodMeta } from "./transport.ts";
import type { HttpRouteMeta, HttpRequestEncoding, HttpResponseEncoding } from "./http-route.ts";
import {
  HABITAT_RPC_LONG_TIMEOUT_MS,
  HABITAT_RPC_READ_TIMEOUT_MS,
  HABITAT_RPC_WRITE_TIMEOUT_MS,
} from "./timeouts.ts";

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
  /** 覆盖读 3s / 写 10s 默认档 */
  timeoutMs?: number;
};

/** HTTP + WS 双传输（只读默认 HTTP GET；写入默认 WS）；超时默认读 3s / 写 10s */
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
    timeoutMs:
      options?.timeoutMs ?? (readOnly ? HABITAT_RPC_READ_TIMEOUT_MS : HABITAT_RPC_WRITE_TIMEOUT_MS),
  };
  if (options?.http) {
    meta.httpOverrides = options.http;
  }
  return meta;
}

/**
 * 导入 / rebuild / LLM 相关等长任务：在 dual 传输上挂 30s 档。
 * `readOnly` 仍控制默认传输与 HTTP verb。
 */
export function longOpMeta(
  readOnly = false,
  options?: Omit<DualTransportMetaOptions, "timeoutMs">,
): HabitatMethodMeta {
  return dualTransportMeta(readOnly, {
    ...options,
    timeoutMs: HABITAT_RPC_LONG_TIMEOUT_MS,
  });
}

/** 仅 HTTP 传输（REST /rpc/v1/{path}）；默认读档 3s */
export function httpTransportMeta(
  timeoutMs: number = HABITAT_RPC_READ_TIMEOUT_MS,
): HabitatMethodMeta {
  return {
    transports: ["http"],
    defaultByProfile: { habitat: "http", outpost: "http" },
    fallback: false,
    timeoutMs,
  };
}

/** WS-only（流式 / outpost / terminal）；默认写档 10s */
export function wsOnlyMeta(timeoutMs: number = HABITAT_RPC_WRITE_TIMEOUT_MS): HabitatMethodMeta {
  return {
    transports: ["ws"],
    defaultByProfile: { habitat: "ws", outpost: "ws" },
    fallback: false,
    timeoutMs,
  };
}

/** 仅 HTTP + 匿名可访问（health / TLS CA 等基础设施探活）；默认读档 3s */
export function publicHttpMeta(timeoutMs: number = HABITAT_RPC_READ_TIMEOUT_MS): HabitatMethodMeta {
  return {
    transports: ["http"],
    defaultByProfile: { habitat: "http", outpost: "http" },
    fallback: false,
    auth: "optional",
    timeoutMs,
  };
}

/** publicHttpMeta + raw Response 响应（TLS PEM/QR 等） */
export function rawPublicHttpMeta(
  timeoutMs: number = HABITAT_RPC_READ_TIMEOUT_MS,
): HabitatMethodMeta {
  return {
    ...publicHttpMeta(timeoutMs),
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
  /** 客户端请求超时（ms）；省略则用长任务档 30s；大文件请显式设 BINARY 常量 */
  timeoutMs?: number;
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
    timeoutMs: options.timeoutMs ?? HABITAT_RPC_LONG_TIMEOUT_MS,
    ...(options.auth !== undefined ? { auth: options.auth } : {}),
    httpOverrides,
  };
}
