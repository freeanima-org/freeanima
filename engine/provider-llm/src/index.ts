export type { LlmTurnMessage, MessagePayload, OpenAiToolSchema, ToolCall } from "./messages.ts";

export type {
  ExtendedParamKey,
  LlmCallParams,
  LlmParamKey,
  ModelInfo,
  SupportedParam,
} from "./model.ts";
export {
  EXTENDED_PARAM_KEYS,
  LLM_PARAM_KEYS,
  clampCallParams,
  mergeCallParams,
  modelSupports,
} from "./model.ts";

export {
  ProviderError,
  classifyProviderError,
  isProviderError,
  providerErrorFromHttpStatus,
} from "./errors.ts";
export type { ErrorClassification, ProviderErrorCode } from "./errors.ts";

export type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke.ts";

export type { BackendContext } from "./backend.ts";
export { BackendRegistry, LlmBackend } from "./backend.ts";

export type { ProviderHealth, ProviderSpec } from "./provider.ts";
export { LlmProvider, ProviderRegistry } from "./provider.ts";

export type {
  LlmProfileDef,
  ProfileBindOptions,
  ProfileChatOptions,
  ProfileValidationIssue,
  ProfileValidationResult,
  RouteHopSpec,
} from "./profile.ts";
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
} from "./profile.ts";
