import { z } from "zod";

/** bge-m3 默认维度（与 engine-db SEMANTIC_EMBEDDING_DIMENSIONS 一致） */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export const embeddingConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    base_url: z.string().optional(),
    api_key: z.string().optional(),
    model: z.string().optional(),
    dimensions: z.number().int().positive().optional(),
    timeout_ms: z.number().int().positive().optional(),
  })
  .optional();

export type EmbeddingConfigInput = z.infer<typeof embeddingConfigSchema>;
