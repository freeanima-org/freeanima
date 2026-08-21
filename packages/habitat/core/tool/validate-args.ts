import { asRecord } from "@freeanima/shared/util";
import { z } from "zod";
import { formatZodError } from "@freeanima/habitat/core/util";
import type { JsonSchemaObject } from "./registry.ts";
import type { ParsedToolResult } from "./json-util.ts";
import { normalizeJsonSchema } from "./mcp-schema.ts";

const schemaCache = new WeakMap<object, z.ZodType>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function looksLikeObjectSchema(schema: Record<string, unknown>): boolean {
  if (schema.type === "object") return true;
  if (schema.type != null) return false;
  return schema.properties != null || schema.additionalProperties != null;
}

/** 递归默认 additionalProperties=false；已显式声明的保持不变。不改入参。 */
export function withStrictAdditionalProperties(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => withStrictAdditionalProperties(item));
  }
  if (!isPlainObject(schema)) return schema;

  const out: Record<string, unknown> = { ...schema };
  if (looksLikeObjectSchema(out) && out.additionalProperties === undefined) {
    out.additionalProperties = false;
  }

  if (isPlainObject(out.properties)) {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out.properties)) {
      props[key] = withStrictAdditionalProperties(value);
    }
    out.properties = props;
  }
  if (out.items != null) {
    out.items = withStrictAdditionalProperties(out.items);
  }
  if (isPlainObject(out.additionalProperties)) {
    out.additionalProperties = withStrictAdditionalProperties(out.additionalProperties);
  }
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const arr = out[key];
    if (Array.isArray(arr)) {
      out[key] = arr.map((item) => withStrictAdditionalProperties(item));
    }
  }
  if (out.not != null) {
    out.not = withStrictAdditionalProperties(out.not);
  }
  if (isPlainObject(out.$defs)) {
    const defs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out.$defs)) {
      defs[key] = withStrictAdditionalProperties(value);
    }
    out.$defs = defs;
  }
  if (isPlainObject(out.definitions)) {
    const defs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out.definitions)) {
      defs[key] = withStrictAdditionalProperties(value);
    }
    out.definitions = defs;
  }
  return out;
}

/** Build validation schema: reject unknown keys on every object unless explicitly allowed */
function toolArgsZodSchema(parameters: JsonSchemaObject): z.ZodType {
  const cached = schemaCache.get(parameters);
  if (cached) return cached;

  const normalized = normalizeJsonSchema(parameters);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- withStrict 仍为 JSON Schema 对象形
  const forValidation = withStrictAdditionalProperties(normalized) as JsonSchemaObject;
  // ToolDef.parameters 为宽松 JsonSchemaObject；运行时再交给 Zod 解析
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Zod fromJSONSchema 输入边界
  const schema = z.fromJSONSchema(forValidation as Parameters<typeof z.fromJSONSchema>[0]);
  schemaCache.set(parameters, schema);
  return schema;
}

/**
 * Runtime gate for tool call args against ToolDef.parameters (JSON Schema).
 * Type errors and unrecognized keys fail; does not strip unknown fields.
 */
export function validateToolArgs(
  parameters: JsonSchemaObject,
  args: Record<string, unknown>,
): ParsedToolResult<Record<string, unknown>> {
  const result = toolArgsZodSchema(parameters).safeParse(args);
  if (!result.success) {
    return { ok: false, error: `invalid tool arguments: ${formatZodError(result.error)}` };
  }
  return { ok: true, data: asRecord(result.data) ?? {} };
}
