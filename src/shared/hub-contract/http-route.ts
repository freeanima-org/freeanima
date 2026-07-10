import type { z as zod } from "zod";

/** HTTP REST 路由元数据（相对 /hub/rpc/v1/） */
export type HttpRouteMeta = {
  verb: "GET" | "POST";
  /** 相对 /hub/rpc/v1/ 的路径，如 task/list、task/get/:id */
  path: string;
  /** path 中的具名参数，按顺序 */
  pathParams?: readonly string[];
};

/** 无法从 input schema 自动推导的 path / verb 覆盖 */
export const HTTP_ROUTE_OVERRIDES: Partial<Record<string, Partial<HttpRouteMeta>>> = {
  "conversation.messages": { pathParams: ["conversation_id"] },
  "conversation.tail": { pathParams: ["conversation_id"] },
  "vault.get": { verb: "POST" },
  "vault.crypto.get": { verb: "POST" },
};

const WRITE_PATH_ACTIONS = new Set([
  "patch",
  "delete",
  "complete",
  "uncomplete",
  "archive",
  "unarchive",
]);

type ZodSchema = zod.ZodTypeAny & { type?: string };

function unwrapZodType(schema: zod.ZodTypeAny): zod.ZodTypeAny {
  let current: zod.ZodTypeAny = schema;
  for (let depth = 0; depth < 8; depth++) {
    const typed = current as ZodSchema;
    if (typed.type === "optional" || typed.type === "nullable") {
      const unwrap = (current as { unwrap?: () => zod.ZodTypeAny }).unwrap;
      if (unwrap) {
        current = unwrap.call(current);
        continue;
      }
    }
    if (typed.type === "default") {
      const removeDefault = (current as { removeDefault?: () => zod.ZodTypeAny }).removeDefault;
      if (removeDefault) {
        current = removeDefault.call(current);
        continue;
      }
    }
    break;
  }
  return current;
}

function getObjectShape(schema: zod.ZodTypeAny): Record<string, zod.ZodTypeAny> | null {
  const unwrapped = unwrapZodType(schema) as ZodSchema;
  if (unwrapped.type === "object") {
    const shape = (unwrapped as { shape?: Record<string, zod.ZodTypeAny> }).shape;
    return shape ?? null;
  }
  if (unwrapped.type === "pipe") {
    const inner = (unwrapped as { in?: zod.ZodTypeAny }).in;
    if (inner) return getObjectShape(inner);
  }
  return null;
}

function shapeHasIntField(shape: Record<string, zod.ZodTypeAny>, key: string): boolean {
  const field = shape[key];
  if (!field) return false;
  const unwrapped = unwrapZodType(field) as ZodSchema & { isInt?: boolean };
  return unwrapped.type === "number" && unwrapped.isInt === true;
}

function inferPathParams(method: string, input: zod.ZodTypeAny): readonly string[] {
  const override = HTTP_ROUTE_OVERRIDES[method]?.pathParams;
  if (override) return override;

  const shape = getObjectShape(input);
  if (!shape) return [];

  const action = method.split(".").pop() ?? "";

  if (method.endsWith(".get") && shapeHasIntField(shape, "id")) {
    return ["id"];
  }

  if (WRITE_PATH_ACTIONS.has(action) && shapeHasIntField(shape, "id")) {
    return ["id"];
  }

  return [];
}

function buildPathWithParams(basePath: string, pathParams: readonly string[]): string {
  if (pathParams.length === 0) return basePath;
  return `${basePath}/${pathParams.map((p) => `:${p}`).join("/")}`;
}

/** 从 method 名、input schema 与 readOnly 推导 HTTP REST 路由 */
export function buildHttpRouteMeta(
  method: string,
  input: zod.ZodTypeAny,
  readOnly: boolean,
  partial?: Partial<HttpRouteMeta>,
): HttpRouteMeta {
  const override = HTTP_ROUTE_OVERRIDES[method];
  const verb = partial?.verb ?? override?.verb ?? (readOnly ? "GET" : "POST");
  const pathParams = partial?.pathParams ?? override?.pathParams ?? inferPathParams(method, input);
  const defaultPath = method.replaceAll(".", "/");
  const path = partial?.path ?? override?.path ?? buildPathWithParams(defaultPath, pathParams);

  const meta: HttpRouteMeta = { verb, path };
  if (pathParams.length > 0) {
    meta.pathParams = pathParams;
  }
  return meta;
}

/** dualTransportMeta 的 fallback 与 readOnly 一致：true=只读 GET，false=写入 POST */
export function isReadOnlyHubMeta(meta: { fallback?: boolean }): boolean {
  return meta.fallback !== false;
}

/** 供 http-rest-router 复用：按 schema 将 query/path 字符串转为标量 */
export function coercePayloadForSchema(
  payload: Record<string, unknown>,
  input: zod.ZodTypeAny,
): Record<string, unknown> {
  const shape = getObjectShape(input);
  if (!shape) return payload;

  const out: Record<string, unknown> = { ...payload };
  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (!(key in out)) continue;
    const val = out[key];
    if (typeof val !== "string") continue;
    const unwrapped = unwrapZodType(fieldSchema) as ZodSchema;
    if (unwrapped.type === "number" && /^-?\d+$/.test(val)) {
      out[key] = Number(val);
    } else if (unwrapped.type === "boolean" && (val === "true" || val === "false")) {
      out[key] = val === "true";
    } else if (
      (unwrapped.type === "object" || unwrapped.type === "array") &&
      (val.startsWith("{") || val.startsWith("["))
    ) {
      try {
        out[key] = JSON.parse(val) as unknown;
      } catch {
        /* keep raw string; Zod will fail with a clear error */
      }
    }
  }
  return out;
}

/** 供单测：unwrap zod v4 schema */
export { unwrapZodType, getObjectShape };
