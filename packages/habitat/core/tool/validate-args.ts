import { z } from "zod";
import { formatZodError } from "@freeanima/habitat/core/util";
import type { JsonSchemaObject } from "./registry.ts";
import type { ParsedToolResult } from "./json-util.ts";
import { normalizeJsonSchema } from "./mcp-schema.ts";

const schemaCache = new WeakMap<object, z.ZodType>();

/** Build validation schema: default reject unknown top-level keys unless explicitly allowed */
function toolArgsZodSchema(parameters: JsonSchemaObject): z.ZodType {
  const cached = schemaCache.get(parameters);
  if (cached) return cached;

  const normalized = normalizeJsonSchema(parameters);
  const forValidation: JsonSchemaObject = {
    ...normalized,
    additionalProperties: parameters.additionalProperties ?? false,
  };
  // ToolDef.parameters 为宽松 JsonSchemaObject；运行时再交给 Zod 解析
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
  return { ok: true, data: result.data as Record<string, unknown> };
}
