export type { MemoryService } from "./memory-service.ts";
export {
  createEmbeddedMemoryService,
  semanticRowToMemoryRecord,
  provenanceFromSourceConversations,
} from "./embedded.ts";
export type { CreateEmbeddedMemoryServiceOpts } from "./embedded.ts";
export { createRemoteMemoryService } from "./remote.ts";
export type { RemoteMemoryServiceOpts } from "./remote.ts";
export { createMemoryService } from "./factory.ts";
export type { CreateMemoryServiceOpts } from "./factory.ts";
export { MemoryMethodNotImplementedError } from "./errors.ts";
export { bumpReferenceCountsFromTexts } from "./cite.ts";
export {
  createRetainWatermarkStore,
  getRetainWatermark,
  setRetainWatermark,
  retainWatermarkKvKey,
  type RetainWatermark,
  type RetainWatermarkStore,
} from "./retain-watermark.ts";
export {
  registerRetainEngine,
  resetRetainEngineForTests,
  runRetainEngine,
  tryGetRetainEngine,
  type RetainEngineFn,
  type RetainEngineInput,
  type RetainEngineItem,
  type RetainEngineResult,
} from "./retain-engine-port.ts";
export {
  registerReflectEngine,
  resetReflectEngineForTests,
  runReflectEngine,
  defaultReflect,
} from "./reflect.ts";
export {
  registerRetainLlm,
  resetRetainLlmForTests,
  runRetainLlm,
  isRetainLlmRegistered,
  type RetainLlmFn,
  type RetainLlmInput,
  type RetainLlmResult,
} from "./retain-llm-port.ts";
export {
  registerReflectLlm,
  resetReflectLlmForTests,
  runReflectLlm,
  isReflectLlmRegistered,
  type ReflectLlmFn,
  type ReflectLlmInput,
  type ReflectLlmResult,
} from "./reflect-llm-port.ts";
export { runBuiltinRetain } from "./builtin-retain.ts";
export { runBuiltinReflect } from "./builtin-reflect.ts";
export { runRetainCatchUp, type RetainCatchUpResult } from "./retain-catch-up.ts";
export type * from "./types.ts";
