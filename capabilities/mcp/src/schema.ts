import { toolError } from "@freeanima/engine-tool";

/** MCP tools/list inputSchema → OpenAI function parameters (flat JSON Schema) */
export function mcpToolParameters(mcpTool: {
  inputSchema?: Record<string, unknown>;
}): Record<string, unknown> {
  return mcpTool.inputSchema ?? { type: "object", properties: {} };
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
