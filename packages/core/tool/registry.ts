import type { z } from "zod";

/** JSON Schema object subset (OpenAI function parameters) */
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

/** Tool success return shape: structured JSON (toolResult) or LLM-readable plain text */
export type ToolReturnKind = "json" | "text";

export type ToolDef = {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
  handler: ToolHandler;
  requiresEnv?: string[];
  returnKind?: ToolReturnKind;
  /** Derived from returnZod; text tools may also be hand-written */
  returnSchema?: JsonSchemaObject;
  /** Success return Zod SSOT */
  returnZod?: z.ZodType;
  /** Schema-validated faithful example */
  returnExample?: unknown;
  /** Readable format hint for text tools */
  returnTextHint?: string;
  /** When true, exposed via Habitat /mcp Streamable HTTP endpoint */
  exposeMcp?: boolean;
};

/** Append return JSON Schema into description so models see it via standard tool fields. */
export function descriptionWithReturnSchema(
  description: string,
  returnSchema: JsonSchemaObject | undefined,
): string {
  if (!returnSchema) return description;
  return `${description}\n\nReturns (JSON Schema): ${JSON.stringify(returnSchema)}`;
}

/** Convert ToolDef to OpenAI Chat Completions `tools[]` entry */
export function openaiFunctionSchema(t: ToolDef): {
  type: "function";
  function: { name: string; description: string; parameters: JsonSchemaObject };
} {
  return {
    type: "function",
    function: {
      name: t.name,
      description: descriptionWithReturnSchema(t.description, t.returnSchema),
      parameters: t.parameters,
    },
  };
}

export type OpenAiToolEntry = ReturnType<typeof openaiFunctionSchema>;
