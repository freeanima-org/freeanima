import type { z } from "zod";

/** JSON Schema object 子集（OpenAI function parameters） */
export type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  enum?: unknown[];
  items?: unknown;
  [key: string]: unknown;
};

export type ToolArgs = Record<string, unknown>;

export type ToolHandler = (args: ToolArgs) => string | Promise<string>;

/** 工具成功返回的约定形态：结构化 JSON（toolResult）或 LLM 可读纯文本 */
export type ToolReturnKind = "json" | "text";

export type ToolDef = {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
  handler: ToolHandler;
  requiresEnv?: string[];
  returnKind?: ToolReturnKind;
  /** 由 returnZod 推导；text 工具也可手写 */
  returnSchema?: JsonSchemaObject;
  /** 成功返回 Zod SSOT */
  returnZod?: z.ZodType;
  /** 经 schema 校验的保真示例 */
  returnExample?: unknown;
  /** text 工具的可读格式说明 */
  returnTextHint?: string;
};

/** 将 ToolDef 转为 OpenAI Chat Completions `tools[]` 项 */
export function openaiFunctionSchema(t: ToolDef): {
  type: "function";
  function: { name: string; description: string; parameters: JsonSchemaObject };
} {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  };
}

export type OpenAiToolEntry = ReturnType<typeof openaiFunctionSchema>;
