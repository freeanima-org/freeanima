import { SEMANTIC_MEMORY_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SEMANTIC_MEMORY_COMPONENT };

import { z } from "zod";

import {
  normalizeSemanticMemoryType,
  semanticMemoryStatusSchema,
  semanticMemoryTypeSchema,
  type SemanticMemoryStatus,
  type SemanticMemoryType,
} from "@freeanima/shared/db-shapes";

export {
  semanticMemoryTypeSchema,
  semanticMemoryStatusSchema,
  normalizeSemanticMemoryType,
  type SemanticMemoryType,
  type SemanticMemoryStatus,
};

export const semanticMemoryBodySchema = z.object({
  /** 旧 semantic_memory.type（与 entities.type 区分） */
  memory_kind: semanticMemoryTypeSchema.default("world"),
  status: semanticMemoryStatusSchema.default("active"),
  source_conversations: z.array(z.string()).default([]),
  observed_at: z.string().nullable().optional(),
  occurred_at: z.string().nullable().optional(),
  /** 迁移期保留旧 f-xxx；验证后可弃 */
  legacy_id: z.string().optional(),
});

export type SemanticMemoryBody = z.infer<typeof semanticMemoryBodySchema>;
