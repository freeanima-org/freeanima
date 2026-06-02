import { toolError } from "@freeanima/legacy-kernel";


/** MCP tools/list 的 inputSchema → OpenAI function parameters（扁平 JSON Schema） */
export function mcpToolParameters(mcpTool: {
  inputSchema?: Record<string, unknown>;
}): Record<string, unknown> {
  return mcpTool.inputSchema ?? { type: "object", properties: {} };
}

/** 从 MCP tools/call 结果提取文本；错误时返回 {"error":"..."} JSON */
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
