import type { z } from "zod";
import { toolArgsSchema, toolErrorSchema, type ToolErrorResult } from "./tool-json.ts";

/** 工具返回须为 JSON 字符串；错误格式 {"error":"..."} */
export function toolResult(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, (_, v) => v, 0);
}

export function toolError(message: string): string {
  return JSON.stringify({ error: message });
}

export type { ToolErrorResult };

export function isToolError(parsed: unknown): parsed is ToolErrorResult {
  return toolErrorSchema.safeParse(parsed).success;
}

export type ParsedToolResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** 解析工具返回 JSON 字符串；约定错误为 {"error":"..."} */
export function parseToolResult<T = unknown>(
  raw: string,
  schema?: z.ZodType<T>,
): ParsedToolResult<T> {
  try {
    const parsed: unknown = JSON.parse(raw);
    const err = toolErrorSchema.safeParse(parsed);
    if (err.success) return { ok: false, error: err.data.error };
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) return { ok: false, error: "validation failed" };
      return { ok: true, data: result.data };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
}

/** 解析 LLM tool_call arguments JSON */
export function parseToolArgs(
  raw: string | undefined | null,
): ParsedToolResult<Record<string, unknown>> {
  const text = raw?.trim() || "{}";
  try {
    const parsed: unknown = JSON.parse(text);
    const result = toolArgsSchema.safeParse(parsed);
    if (!result.success) {
      return { ok: false, error: "tool arguments must be a JSON object" };
    }
    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: "invalid tool arguments JSON" };
  }
}

export { toolArgsSchema, toolErrorSchema };
