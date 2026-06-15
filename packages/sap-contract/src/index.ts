export { SAP_VERSION, parseSapEnvelope, serializeSapEnvelope } from "./protocol.ts";
export type { SapEnvelope, SapError } from "./protocol.ts";

export {
  normalizeAppSlug,
  normalizeInstanceId,
  formatSapToolName,
  formatSapToolNameAlias,
  parseSapToolName,
  isSapPrefixedToolName,
  sapToolsetId,
  resolvePlatformForApp,
  SAP_APP_PLATFORM_MAP,
} from "./naming.ts";
export type { ParsedSapToolName } from "./naming.ts";

export {
  connectPayloadSchema,
  connectedPayloadSchema,
  heartbeatPayloadSchema,
} from "./frames/lifecycle.ts";
export type { ConnectPayload, ConnectedPayload, HeartbeatPayload } from "./frames/lifecycle.ts";

export {
  sessionCreateInputSchema,
  sessionCreateOutputSchema,
  sessionListInputSchema,
  sessionListOutputSchema,
  sessionMessagesInputSchema,
  sessionPatchTitleInputSchema,
  sessionSubscribeInputSchema,
  sessionUpdatedPayloadSchema,
} from "./frames/session.ts";
export type {
  SessionCreateInput,
  SessionCreateOutput,
  SessionListInput,
  SessionListOutput,
  SessionMessagesInput,
  SessionPatchTitleInput,
  SessionSubscribeInput,
  SessionUpdatedPayload,
} from "./frames/session.ts";

export {
  messageSendInputSchema,
  messageSendOutputSchema,
  mapStreamApiEventToSap,
  mapRuntimeStreamEventToSap,
  mapSapStreamMethodToApi,
  streamEventMethods,
} from "./frames/message.ts";
export type {
  MessageSendInput,
  MessageSendOutput,
  StreamApiLikeEvent,
  StreamEventMethod,
} from "./frames/message.ts";

export {
  toolRegisterInputSchema,
  toolRegisterOutputSchema,
  toolUnregisterInputSchema,
  toolCallPayloadSchema,
  toolResultInputSchema,
  toolErrorInputSchema,
  sapToolDefInputSchema,
} from "./frames/tool.ts";
export type {
  ToolRegisterInput,
  ToolRegisterOutput,
  ToolUnregisterInput,
  ToolCallPayload,
  ToolResultInput,
  ToolErrorInput,
  SapToolDefInput,
} from "./frames/tool.ts";

export {
  terminalAttachInputSchema,
  terminalAttachOutputSchema,
  terminalWriteInputSchema,
  terminalResizeInputSchema,
  terminalCloseInputSchema,
  TERMINAL_EVENT_METHODS,
} from "./frames/terminal.ts";
export type {
  TerminalAttachInput,
  TerminalAttachOutput,
  TerminalWriteInput,
  TerminalResizeInput,
  TerminalCloseInput,
  TerminalEventMethod,
} from "./frames/terminal.ts";

export { defineSapRouter, SAP_METHODS } from "./router.ts";
export type {
  SapMethod,
  SapRouterInputs,
  SapRouterOutputs,
  SapServerHandlers,
  SapRequestContext,
  SapClient,
} from "./router.ts";

export { createSapClient } from "./client.ts";
