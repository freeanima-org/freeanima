import { z } from "zod";

import type { JsonSchemaObject, ToolDef, ToolReturnKind } from "./registry.ts";
import {
  textReturnJsonSchema,
  toolErrorReturnExample,
  toolErrorReturnSchema,
} from "./return-schemas/common.ts";

export type ToolReturnContractFields = Pick<
  ToolDef,
  "returnKind" | "returnZod" | "returnExample" | "returnSchema" | "returnTextHint"
>;

function zodToJsonSchema(schema: z.ZodType): JsonSchemaObject {
  return z.toJSONSchema(schema);
}

function assertExampleMatchesSchema(schema: z.ZodType, example: unknown, label: string): void {
  const result = schema.safeParse(example);
  if (!result.success) {
    throw new Error(`${label}: return example does not match schema: ${result.error.message}`);
  }
}

/** Success return contract for structured JSON tools */
export function defineToolReturn<T extends z.ZodType>(opts: {
  schema: T;
  example: z.infer<T>;
}): ToolReturnContractFields {
  assertExampleMatchesSchema(opts.schema, opts.example, "defineToolReturn");
  return {
    returnKind: "json",
    returnZod: opts.schema,
    returnExample: opts.example,
    returnSchema: zodToJsonSchema(opts.schema),
  };
}

/** Success return contract for LLM-readable plain-text tools */
export function defineTextToolReturn(opts: {
  hint: string;
  example: string;
}): ToolReturnContractFields {
  if (!opts.example.trim()) {
    throw new Error("defineTextToolReturn: example must be non-empty");
  }
  return {
    returnKind: "text",
    returnExample: opts.example,
    returnTextHint: opts.hint,
    returnSchema: {
      ...textReturnJsonSchema,
      description: opts.hint,
    },
  };
}

/** Resolve return fields from ToolDef for status API */
export function resolveToolReturnFields(def: ToolDef): {
  return_kind: ToolReturnKind;
  return_schema?: JsonSchemaObject;
  return_example?: unknown;
  return_text_hint?: string;
} {
  const return_kind = def.returnKind ?? "json";
  const out: {
    return_kind: ToolReturnKind;
    return_schema?: JsonSchemaObject;
    return_example?: unknown;
    return_text_hint?: string;
  } = { return_kind };

  if (def.returnZod) {
    out.return_schema = zodToJsonSchema(def.returnZod);
  } else if (def.returnSchema) {
    out.return_schema = def.returnSchema;
  }

  if (def.returnExample !== undefined) {
    out.return_example = def.returnExample;
  }
  if (def.returnTextHint) {
    out.return_text_hint = def.returnTextHint;
  }

  return out;
}

/** Attach return contracts to ToolDef list by name */
export function attachToolReturns(
  tools: ToolDef[],
  returns: Partial<Record<string, ToolReturnContractFields>>,
): ToolDef[] {
  return tools.map((tool) => {
    const contract = returns[tool.name];
    return contract ? { ...tool, ...contract } : tool;
  });
}

/** Global error return contract (injected at status API layer) */
export function globalToolErrorContract(): {
  error_schema: JsonSchemaObject;
  error_example: typeof toolErrorReturnExample;
} {
  return {
    error_schema: zodToJsonSchema(toolErrorReturnSchema),
    error_example: toolErrorReturnExample,
  };
}
