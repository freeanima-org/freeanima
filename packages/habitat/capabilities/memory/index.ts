export { createSemanticMemory, type SemanticMemory } from "./fact.ts";
export { conversationUpdated, type ConversationUpdatedPayload } from "./events.ts";
export {
  createEmbeddedMemoryService,
  createRemoteMemoryService,
  createMemoryService,
  MemoryMethodNotImplementedError,
  provenanceFromSourceConversations,
  semanticRowToMemoryRecord,
  registerRetainEngine,
  resetRetainEngineForTests,
  type CreateEmbeddedMemoryServiceOpts,
  type RemoteMemoryServiceOpts,
  type CreateMemoryServiceOpts,
  type MemoryService,
} from "./service/index.ts";
export type * from "./service/types.ts";
export {
  formatMemoryReferenceMarker,
  formatResidentMemoryLine,
  parseMemoryReferenceMarkers,
  MEMORY_REFERENCE_CITATION_RULE,
  MEMORY_RECALL_STRATEGY_RULE,
  MEMORY_SEMANTIC_CITATION_TOOL_HINT,
  memoryReferenceWeight,
} from "./memory-reference.ts";
export { syncSemanticMemoryReferenceCounts } from "./reference-sync.ts";
export { filterRecallableMessages, type RecallableMessage } from "./message-filter.ts";
export {
  search,
  searchSemanticMemory,
  searchDialogue,
  searchDialogueOnly,
  memoryScopedSearch,
  type SearchResult,
  type MemoryScopedHit,
  type MemoryRecallHit,
  type MemoryScopedHitType,
  type MemoryRecallHitType,
  type MemoryScopedSearchResult,
  type MemoryRecallResult,
  type SemanticRecallHit,
  type ConversationRecallHit,
  type LimbicRecallHit,
  type AutobiographicalRecallHit,
} from "./search.ts";
export { registerMemoryTools } from "./register-tools.ts";
export { registerMemoryPassiveRecallHook } from "./register-hooks.ts";
export {
  runPassiveRecallDebug,
  type PassiveRecallDebugResult,
} from "./passive-recall/debug-run.ts";
export {
  semanticMemoryToolDefs,
  rememberFromArgs,
  createSemanticMemoryFromArgs,
} from "./semantic-memory-tools.ts";
export {
  decomposeSystemPromptParts,
  composeSystemPrompt,
  type SystemPromptParts,
} from "./system-prompt.ts";
export {
  registerAutobiographyEngine,
  resetAutobiographyEngineForTests,
  runAutobiographyEngine,
  type AutobiographyEngineFn,
  type AutobiographyEngineInput,
  type AutobiographyEngineResult,
} from "./autobiography-port.ts";
export {
  runSelfAutobiography,
  runSelfAutobiographyWithLog,
  buildAutobiographySummary,
  refreshAutobiographySummaryBlock,
  type RunSelfAutobiographyOpts,
  type SelfAutobiographyResult,
} from "./autobiography/run.ts";
export {
  cstDayRange,
  LIGHT_SLEEP_INSTRUCTION_MESSAGE,
  RETAIN_INSTRUCTION_MESSAGE,
  type LightSleepDayRange,
  type DayWindowRange,
} from "./day-window/build-messages.ts";
export { readDeepSleepState, writeDeepSleepState, recordDeepSleepRun } from "./reflect/state.ts";
export { applyDeepSleepToolResult } from "./reflect/apply-tool-result.ts";
export type { DeepSleepResult } from "./reflect/types.ts";
export {
  buildSleepSummary,
  SLEEP_JOB_IDS,
  MEMORY_MAINTENANCE_JOB_ID,
  type SleepSummary,
} from "./sleep-records.ts";
export {
  resolveTemporalSummaryConfig,
  registerTemporalSummaryEngine,
  resetTemporalSummaryEngineForTests,
  runTemporalSummaryTick,
  runTemporalSummaryDay,
  runTemporalSummaryCascade,
  rebuildMonthSummary,
  rebuildYearSummary,
  listTemporalSystemRolls,
  regenerateTemporalSystemRoll,
  buildTemporalSummarySystemSection,
  temporalSummarySystemTruncatedSourceRef,
  TEMPORAL_SUMMARY_SYSTEM_TRUNCATED_SOURCE_PREFIX,
  peerRollSourcesFp,
  peerRollRedisKey,
  injectTemporalPeerRollups,
  TEMPORAL_SUMMARY_PEERS_ASSISTANT_NAME,
} from "./temporal-summary/index.ts";
