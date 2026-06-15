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
  sessionCommandsInputSchema,
  sessionCommandsOutputSchema,
  sessionCommandItemSchema,
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
  SessionCommandsInput,
  SessionCommandsOutput,
  SessionCommandItem,
} from "./frames/session.ts";

export {
  sessionAcpDockInputSchema,
  sessionAcpDockOutputSchema,
  acpDockTaskSchema,
} from "./frames/acp.ts";
export type { SessionAcpDockInput, SessionAcpDockOutput, AcpDockTask } from "./frames/acp.ts";

export {
  fridgeListInputSchema,
  fridgeListOutputSchema,
  fridgeMagnetItemSchema,
} from "./frames/fridge.ts";
export type { FridgeListInput, FridgeListOutput, FridgeMagnetItem } from "./frames/fridge.ts";

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
export type { CreateSapClientOptions } from "./client.ts";
export { runSapTransport } from "./transport.ts";
export type {
  RunSapTransportOptions,
  SapReconnectPolicy,
  SapTransportHandle,
} from "./transport.ts";
export {
  createSapBrowserClient,
  loadParlorSatelliteConfig,
  PARLOR_PLATFORM,
} from "./browser-client.ts";
export type {
  ParlorSatelliteConfig,
  SapBrowserClient,
  SapBrowserClientOptions,
  SubscribeCallbacks,
} from "./browser-client.ts";
export {
  createSapRelayClient,
  resolveSapRelayWsUrl,
  SAP_RELAY_READY_METHOD,
} from "./relay-client.ts";
export type { CreateSapRelayClientOptions, SapRelayClient } from "./relay-client.ts";
export { createSapRelayBrowserClient } from "./relay-browser-client.ts";
export type {
  SapRelayBrowserClient,
  SapRelayBrowserClientOptions,
} from "./relay-browser-client.ts";
