export type {
  LlmTurnMessage,
  MessagePayload,
  OpenAiToolSchema,
  ToolCall,
} from "@freeanima/legacy-db";

export type {
  ExtendedParamKey,
  LlmCallParams,
  LlmParamKey,
  ModelInfo,
  SupportedParam,
} from "./model.js";
export {
  EXTENDED_PARAM_KEYS,
  LLM_PARAM_KEYS,
  clampCallParams,
  mergeCallParams,
  modelSupports,
} from "./model.js";

export {
  ProviderError,
  classifyProviderError,
  isProviderError,
  providerErrorFromHttpStatus,
} from "./errors.js";
export type { ErrorClassification, ProviderErrorCode } from "./errors.js";

export type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke.js";

export type { BackendContext } from "./backend.js";
export { BackendRegistry, LlmBackend } from "./backend.js";

export type { ProviderHealth, ProviderSpec } from "./provider.js";
export { LlmProvider, ProviderRegistry } from "./provider.js";

export type {
  LlmProfileDef,
  ProfileBindOptions,
  ProfileChatOptions,
  ProfileValidationIssue,
  ProfileValidationResult,
  RouteHopSpec,
} from "./profile.js";
export {
  BUILTIN_PROFILE_IDS,
  LlmProfile,
  PROFILE_CHAT,
  PROFILE_REFLECT,
  PROFILE_SUMMARY,
  ProfileRegistry,
  assertProfilesValid,
  collectProviderIds,
  hop,
  profileDef,
  validateProfiles,
} from "./profile.js";
