import type { JsonSchemaObject } from "./registry.ts";
import { isToolError, toolError } from "./json-util.ts";
import { toolErrorSchema } from "./tool-json.ts";

const EMPTY_OBJECT_SCHEMA: JsonSchemaObject = { type: "object", properties: {} };

/** Ensure JSON Schema has object type and properties for MCP / OpenAI interchange */
export function normalizeJsonSchema(
  schema?: JsonSchemaObject | Record<string, unknown>,
): JsonSchemaObject {
  if (!schema || typeof schema !== "object") return { ...EMPTY_OBJECT_SCHEMA };
  const type = typeof schema.type === "string" ? schema.type : "object";
  const properties =
    schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? schema.properties
      : {};
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 归一后满足 JsonSchemaObject
  return {
    ...schema,
    type,
    properties,
  } as JsonSchemaObject;
}

/** MCP tools/list inputSchema → OpenAI function parameters */
export function mcpToolParameters(mcpTool: {
  inputSchema?: Record<string, unknown>;
}): JsonSchemaObject {
  return normalizeJsonSchema(mcpTool.inputSchema);
}

/** ToolDef.parameters → MCP tools/list inputSchema */
export function toolParametersToMcpInputSchema(params: JsonSchemaObject): JsonSchemaObject {
  return normalizeJsonSchema(params);
}

export type McpCallToolContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** Tool handler string return → MCP tools/call result */
export function handlerResultToMcpContent(text: string): McpCallToolContent {
  try {
    const parsed: unknown = JSON.parse(text);
    if (toolErrorSchema.safeParse(parsed).success && isToolError(parsed)) {
      return {
        content: [{ type: "text", text: parsed.error }],
        isError: true,
      };
    }
  } catch {
    // plain-text tool success
  }
  return {
    content: [{ type: "text", text }],
  };
}

/** Extract text from MCP tools/call result; returns {"error":"..."} JSON on error */
export function extractMcpResult(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): string {
  const parts: string[] = [];
  for (const item of result.content ?? []) {
    if (item.type === "text" && item.text) parts.push(item.text);
  }
  const text = parts.join("\n");
  if (result.isError) {
    return toolError(text || "MCP tool returned error");
  }
  return text;
}
