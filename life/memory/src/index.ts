export { createSemanticMemory, type SemanticMemory } from "./fact.ts";
export { parseLegacyFact, type LegacyFactData, FRONTMATTER_DELIM } from "./legacy-fact.ts";
export {
  sessionUpdated,
  l3Updated,
  testPing,
  type SessionUpdatedPayload,
  type L3UpdatedPayload,
  type TestPingPayload,
} from "./events.ts";
export {
  isReflectEnabled,
  registerMemoryPipeline,
  registerMemoryHandlers,
  registerEventHandlers,
} from "./pipeline.ts";
export {
  registerReflectChat,
  callReflectChat,
  type ReflectChatFn,
  type ReflectChatMessage,
} from "./reflect-llm.ts";
export { reflectSession, type ReflectSessionResult } from "./reflect.ts";
export {
  registerMemorySessionStore,
  getMemorySessionStore,
  resetMemorySessionStoreForTests,
} from "./session-port.ts";
export {
  registerSemanticMemoryStore,
  getSemanticMemoryStore,
  resetSemanticMemoryStoreForTests,
} from "./semantic-port.ts";
export { filterRecallableMessages, type RecallableMessage } from "./message-filter.ts";
export {
  search,
  searchL3,
  searchL2,
  searchL2Only,
  memorySearchDetailed,
  type SearchResult,
  type MemorySearchL3Hit,
  type MemorySearchL2Hit,
  type MemorySearchResult,
} from "./search.ts";
export { registerMemoryTools } from "./register-tools.ts";
export {
  decomposeSystemPromptParts,
  composeSystemPrompt,
  type SystemPromptParts,
} from "./system-prompt.ts";
