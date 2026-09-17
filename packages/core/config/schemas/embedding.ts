import { z } from "zod";

import { capabilityBindingLooseSchema } from "./capability.ts";

/** bge-m3 default dimensions (matches core/db SEMANTIC_EMBEDDING_DIMENSIONS) */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

/** 文本嵌入主场景；URL/密钥在 connections */
export const embeddingConfigSchema = z
  .object({
    main: capabilityBindingLooseSchema.optional(),
    enabled: z.boolean().optional(),
    dimensions: z.number().int().positive().optional(),
    /** Write / rebuild embed HTTP timeout (default 60s) */
    timeout_ms: z.number().int().positive().optional(),
    /** Retrieval query embed budget; fail-open (default 800ms) */
    query_timeout_ms: z.number().int().positive().optional(),
  })
  .passthrough()
  .optional();

export type EmbeddingConfigInput = z.infer<typeof embeddingConfigSchema>;

export type ResolvedEmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  queryTimeoutMs: number;
};
