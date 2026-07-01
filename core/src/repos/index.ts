export type {
  CompressionState,
  ConversationMessage,
  StoredMessage,
  ConversationMetaMessage,
  ConversationTodoStore,
} from "@freeanima/core/db/domain";
export {
  isAssistantMessage,
  isConversationMeta,
  isSystemMessage,
  isToolMessage,
  isUserMessage,
} from "@freeanima/core/db/domain";

export type {
  SelfBlockRow,
  LimbicMemoryRow,
  SemanticMemoryRow,
  SemanticFtsHit,
  AutobiographicalMemoryRow,
  CronJobRow,
  NotificationRow,
  SapInstanceRow,
} from "@freeanima/core/db/schema/rows";

export type {
  ConversationSummaryRow,
  ConversationListOpts,
  MessageFtsHit,
  MessageRowView,
  ConversationCleanupResult,
} from "../db/pg/conversation/types.ts";

export type {
  SemanticMemoryCreateInput,
  SemanticMemoryUpdateInput,
  SemanticMemorySearchOpts,
  SemanticMemorySortBy,
} from "../db/pg/semantic-memory/types.ts";
export { RESIDENT_PINNED_MAX, RESIDENT_TOP_N } from "../db/pg/semantic-memory/types.ts";

export { semanticFtsHitSchema, semanticMemoryRowSchema } from "./schemas/semantic-memory-row.ts";

export type {
  SelfBlockKey,
  SelfBlockUpsertInput,
  SelfBlockUpdateInput,
} from "../db/pg/self-layer/types.ts";
export { SELF_BLOCK_KEYS } from "../db/pg/self-layer/types.ts";

export type {
  AutobiographicalSignificance,
  AutobiographicalStatus,
  AutobiographicalMemoryCreateInput,
  AutobiographicalListOrder,
  AutobiographicalListOpts,
  AutobiographicalFtsHit,
} from "../db/pg/autobiographical-memory/types.ts";

export type {
  LimbicKind,
  LimbicMemoryCreateInput,
  LimbicListOpts,
  LimbicListByConversationsOpts,
  LimbicListByCreatedOpts,
  LimbicFtsHit,
} from "../db/pg/limbic-memory/types.ts";

export type {
  CronJobCreateInput,
  CronJobBuiltinUpsertInput,
  CronJobUpdateInput,
  CronLogRow,
  CronLogAppendInput,
  CronLogListOpts,
} from "../db/pg/cron/types.ts";

export type {
  PipelineStepRunRow,
  PipelineStepRunAppendInput,
  PipelineStepRunListOpts,
} from "../db/pg/pipeline/types.ts";

export type {
  AutoLlmRunRow,
  AutoLlmRunAppendInput,
  PurgeStaleAutoLlmRunsOpts,
  AutoLlmRunListOpts,
  AutoLlmRunCountOpts,
} from "../db/pg/auto-llm-run/types.ts";

export type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRecipientKind,
  NotificationReadFilter,
  NotificationSourceKind,
} from "../db/pg/notifications/types.ts";
export {
  NOTIFICATION_RECIPIENT_KINDS,
  NOTIFICATION_READ_FILTERS,
  NOTIFICATION_SOURCE_KINDS,
  DEFAULT_NOTIFICATION_RECIPIENT_ID,
} from "../db/pg/notifications/types.ts";

export type {
  MemoryReferenceRow,
  RecordMessageReferencesInput,
} from "../db/pg/memory-reference/types.ts";

export type {
  EntityRow,
  EntityCreateInput,
  EntityUpdateInput,
  EntityListOpts,
  EntitySearchMode,
  EntitySearchOpts,
  EntitySearchHit,
  EntitySearchResult,
} from "../db/pg/entity/types.ts";

export type { SapInstanceUpsertInput } from "../db/pg/sap/types.ts";

export {
  SEMANTIC_MEMORY_ID_PATTERN,
  MEMORY_REFERENCE_MARKER_RE,
  formatMemoryReferenceMarker,
  formatResidentMemoryLine,
  parseMemoryReferenceMarkers,
  MEMORY_REFERENCE_CITATION_RULE,
  MEMORY_SEMANTIC_CITATION_TOOL_HINT,
  MEMORY_REFERENCE_RECENT_WEIGHT,
  MEMORY_REFERENCE_STALE_WEIGHT,
  MEMORY_REFERENCE_DECAY_DAYS,
  memoryReferenceWeight,
} from "./memory-reference/markers.ts";
