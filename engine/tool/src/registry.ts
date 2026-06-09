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

export type ToolDef = {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
  handler: ToolHandler;
  requiresEnv?: string[];
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
