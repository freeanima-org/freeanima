export { createSemanticMemory, type SemanticMemory } from "./fact.ts";
export {
  conversationUpdated,
  semanticMemoryUpdated,
  testPing,
  type ConversationUpdatedPayload,
  type SemanticMemoryUpdatedPayload,
  type TestPingPayload,
} from "./events.ts";
export {
  formatMemoryReferenceMarker,
  formatResidentMemoryLine,
  parseMemoryReferenceMarkers,
  MEMORY_REFERENCE_CITATION_RULE,
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
  memoryRecallSearch,
  type SearchResult,
  type MemoryRecallHit,
  type MemoryRecallHitType,
  type MemoryRecallResult,
  type SemanticRecallHit,
  type ConversationRecallHit,
  type LimbicRecallHit,
  type AutobiographicalRecallHit,
} from "./search.ts";
export { registerMemoryTools } from "./register-tools.ts";
export { registerMemoryPassiveRecallHook } from "./register-hooks.ts";
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
  registerLightSleepEngine,
  resetLightSleepEngineForTests,
  runLightSleepEngine,
  type LightSleepEngineFn,
  type LightSleepEngineInput,
  type LightSleepEngineResult,
} from "./light-sleep-port.ts";
export {
  registerDeepSleepEngine,
  resetDeepSleepEngineForTests,
  runDeepSleepEngine,
  type DeepSleepEngineFn,
  type DeepSleepEngineInput,
  type DeepSleepEngineResult,
} from "./deep-sleep-port.ts";
export { runLightSleep, type LightSleepResult, type RunLightSleepOpts } from "./light-sleep/run.ts";
export { runDeepSleep, type DeepSleepResult, type RunDeepSleepOpts } from "./deep-sleep/run.ts";
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
  buildLightSleepUserMessages,
  buildLimbicUserMessages,
  LIGHT_SLEEP_INSTRUCTION_MESSAGE,
  LIMBIC_INSTRUCTION,
  type LightSleepDayRange,
} from "./light-sleep/build-messages.ts";
export {
  readLightSleepState,
  writeLightSleepState,
  recordLightSleepRun,
} from "./light-sleep/state.ts";
export { readDeepSleepState, writeDeepSleepState, recordDeepSleepRun } from "./deep-sleep/state.ts";
export { applyDeepSleepToolResult } from "./deep-sleep/apply-tool-result.ts";
export {
  buildSleepSummary,
  listDeepSleepRoundLogs,
  SLEEP_JOB_IDS,
  SLEEP_CYCLE_JOB_ID,
  type SleepSummary,
} from "./sleep-records.ts";
export {
  registerDreamEngine,
  resetDreamEngineForTests,
  runDreamEngine,
  type DreamEngineFn,
  type DreamEngineInput,
  type DreamEngineResult,
} from "./dream-engine-port.ts";
export { runDream, type DreamResult, type RunDreamOpts } from "./dream/run.ts";
export {
  gatherDreamInput,
  hasDreamFuel,
  DREAM_MIN_INTENSITY,
  DREAM_LLM_TEMPERATURE,
  type DreamGatherInput,
} from "./dream/gather-input.ts";
export { readDreamState, recordDreamRun, type DreamState } from "./dream/state.ts";
export { registerDreamTools } from "./dream.ts";
export { registerMemoryLimbicTools } from "./memory-limbic.ts";
