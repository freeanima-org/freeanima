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
} from "./model";
export {
  EXTENDED_PARAM_KEYS,
  LLM_PARAM_KEYS,
  clampCallParams,
  mergeCallParams,
  modelSupports,
} from "./model";

export {
  ProviderError,
  classifyProviderError,
  isProviderError,
  providerErrorFromHttpStatus,
} from "./errors";
export type { ErrorClassification, ProviderErrorCode } from "./errors";

export type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke";

export type { BackendContext } from "./backend";
export { BackendRegistry, LlmBackend } from "./backend";

export type { ProviderHealth, ProviderSpec } from "./provider";
export { LlmProvider, ProviderRegistry } from "./provider";

export type {
  LlmProfileDef,
  ProfileBindOptions,
  ProfileChatOptions,
  ProfileValidationIssue,
  ProfileValidationResult,
  RouteHopSpec,
} from "./profile";
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
} from "./profile";
