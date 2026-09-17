import type { JsonSchemaObject } from "./registry.ts";

/** LLM 填写的本次调用意图；供 UI 展示，handler 不消费 */
export const TOOL_CALL_TITLE_KEY = "_title" as const;

export const TOOL_CALL_TITLE_PROPERTY = {
  type: "string",
  description: 'One-line intent of this call for UI (e.g. "修改配置文件", "merger 10054 pr")',
} as const;

/** MCP/ACP 远端 schema 不注入；本地与 outpost remote 注入 */
export function shouldInjectToolCallTitle(toolSetName: string): boolean {
  const n = toolSetName.trim();
  return !n.startsWith("mcp_") && !n.startsWith("acp_");
}

/** 在 parameters.properties 注入必填 `_title`（幂等） */
export function injectToolCallTitle(parameters: JsonSchemaObject): JsonSchemaObject {
  const prevProps =
    parameters.properties &&
    typeof parameters.properties === "object" &&
    !Array.isArray(parameters.properties)
      ? parameters.properties
      : {};
  const properties: Record<string, unknown> = {
    ...prevProps,
    [TOOL_CALL_TITLE_KEY]: { ...TOOL_CALL_TITLE_PROPERTY },
  };
  const prevRequired = Array.isArray(parameters.required)
    ? parameters.required.filter((k): k is string => typeof k === "string")
    : [];
  const required = [TOOL_CALL_TITLE_KEY, ...prevRequired.filter((k) => k !== TOOL_CALL_TITLE_KEY)];
  return {
    ...parameters,
    type: typeof parameters.type === "string" ? parameters.type : "object",
    properties,
    required,
  };
}

export function omitToolCallTitle(args: Record<string, unknown>): Record<string, unknown> {
  if (!(TOOL_CALL_TITLE_KEY in args)) return args;
  const { [TOOL_CALL_TITLE_KEY]: _removed, ...rest } = args;
  return rest;
}

export function toolCallTitleFromArgs(
  args: Record<string, unknown> | undefined | null,
): string | undefined {
  if (!args) return undefined;
  const v = args[TOOL_CALL_TITLE_KEY];
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
