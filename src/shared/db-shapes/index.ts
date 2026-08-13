/** @deprecated 请改用 `@freeanima/shared/pg-shapes` */
export { limbicKindSchema, type LimbicKind } from "@freeanima/shared/pg-shapes/entity/limbic.ts";
export {
  narrativeSignificanceSchema,
  autobiographicalSignificanceSchema,
  narrativeStatusSchema,
  autobiographicalStatusSchema,
  type NarrativeSignificance,
  type NarrativeStatus,
} from "@freeanima/shared/pg-shapes/entity/narrative.ts";
export {
  semanticMemoryTypeSchema,
  semanticMemoryStatusSchema,
  normalizeSemanticMemoryType,
  type SemanticMemoryType,
  type SemanticMemoryStatus,
} from "@freeanima/shared/pg-shapes/entity/semantic-memory.ts";
export {
  clarifyItemSchema,
  type ClarifyItem,
} from "@freeanima/shared/pg-shapes/jsonb/clarify-item.ts";
export type {
  SemanticMemoryRow,
  SemanticFtsHit,
  LimbicMemoryRow,
  AutobiographicalMemoryRow,
} from "@freeanima/shared/pg-shapes/rows/memory-rows.ts";
