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

/** 语义记忆 provenance（#16102）；与 MemoryService MemoryProvenance 同形 */
export const semanticMemoryProvenanceSchema = z.object({
  conversation_id: z.string().min(1),
  message_id_from: z.string().optional(),
  message_id_to: z.string().optional(),
  message_ids: z.array(z.string()).optional(),
});

export const semanticMemoryLinkTypeSchema = z.enum([
  "merged_from",
  "supersedes",
  "conflicts_with",
  "derived_from",
]);

export const semanticMemoryLinkSchema = z.object({
  type: semanticMemoryLinkTypeSchema,
  memory_id: z.number().int().positive(),
});

export const semanticMemoryBodySchema = z.object({
  /** 旧 semantic_memory.type（与 entities.type 区分） */
  memory_kind: semanticMemoryTypeSchema.default("world"),
  status: semanticMemoryStatusSchema.default("active"),
  source_conversations: z.array(z.string()).default([]),
  /** 真源 provenance；缺省时仍可靠 source_conversations 兼容 */
  source: semanticMemoryProvenanceSchema.optional(),
  /** 记忆间 links；默认 [] */
  links: z.array(semanticMemoryLinkSchema).default([]),
  observed_at: z.string().nullable().optional(),
  occurred_at: z.string().nullable().optional(),
  /** 迁移期保留旧 f-xxx；验证后可弃 */
  legacy_id: z.string().optional(),
});

export type SemanticMemoryBody = z.infer<typeof semanticMemoryBodySchema>;
export type SemanticMemoryProvenance = z.infer<typeof semanticMemoryProvenanceSchema>;
export type SemanticMemoryLink = z.infer<typeof semanticMemoryLinkSchema>;
