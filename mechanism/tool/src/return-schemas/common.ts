import { z } from "zod";

import { toolErrorSchema } from "../tool-json.ts";

/** Global tool failure return contract */
export const toolErrorReturnSchema = toolErrorSchema;

export const toolErrorReturnExample = { error: "Example error message" } as const;

/** JSON Schema view for text tool success return */
export const textReturnJsonSchema = {
  type: "string",
  description: "LLM-readable plain text",
} as const;

/** Common ok wrapper */
export const okObjectSchema = z.object({ ok: z.literal(true) });

/** Line-number-prefixed text example (file_read_file, etc.) */
export const textLineNumberExample = "1|First line\n2|Second line";

export function paginatedListSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
  });
}
