import { z } from "zod";

import { contentBlockTypeSchema } from "./components/content-block.ts";

/** content_block 结构化搜索 filters（EntitySearchOpts.filters） */
export const contentBlockSearchFiltersSchema = z
  .object({
    parent_id: z.number().int().positive().optional(),
    block_type: contentBlockTypeSchema.optional(),
    client_op_id: z.string().min(1).optional(),
    conversation_id: z.string().min(1).optional(),
  })
  .strict();

export type ContentBlockSearchFilters = z.infer<typeof contentBlockSearchFiltersSchema>;

export function parseContentBlockSearchFilters(
  raw: Record<string, unknown> | undefined,
): ContentBlockSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = contentBlockSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid content_block filters: ${parsed.error.message}`);
  }
  return parsed.data;
}
