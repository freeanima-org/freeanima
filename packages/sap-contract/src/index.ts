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
  formatSapPlatform,
  isSapPlatform,
  parseSapPlatform,
  isValidSapInstanceId,
  SAP_INSTANCE_ID_PATTERN,
} from "./naming.ts";
export type { ParsedSapToolName, ParsedSapPlatform } from "./naming.ts";

export { generateSapInstanceIdCandidate, assertSapInstanceId } from "./instance-id.ts";

export {
  browserSapInstanceStore,
  memorySapInstanceStore,
  loadSapInstanceId,
  type SapInstanceStore,
} from "./instance-store.ts";
export { fileSapInstanceStore } from "./file-instance-store.ts";

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

export { resolveHubHttpUrl, resolveHubWsUrl, hubHttpFromWsUrl, resolveRelayWsUrl } from "./urls.ts";

export {
  createSapSessionStreamClient,
  sapListSessions,
  sapCreateSession,
  sapGetSessionMessages,
  sapPatchSessionTitle,
  type SubscribeCallbacks,
  type SapSessionStreamClient,
} from "./session-stream-core.ts";

export {
  createSapDirectClient,
  loadDirectSatelliteConfig,
  createSapBrowserClient,
  loadParlorSatelliteConfig,
  PARLOR_PLATFORM,
  formatDirectPlatform,
  type DirectSatelliteConfig,
  type SapDirectClient,
  type SapDirectClientOptions,
} from "./direct-client.ts";

export {
  createSapSidecarClient,
  createSapRelayBrowserClient,
  type SapSidecarClient,
  type SapSidecarClientOptions,
  type SapRelayBrowserClient,
  type SapRelayBrowserClientOptions,
} from "./sidecar-client.ts";

export {
  createSapRelayClient,
  resolveSapRelayWsUrl,
  SAP_RELAY_READY_METHOD,
} from "./relay-client.ts";
export type { CreateSapRelayClientOptions, SapRelayClient } from "./relay-client.ts";

export {
  createSatelliteHub,
  type CreateSatelliteHubOptions,
  type SatelliteHubHandle,
} from "./satellite-hub.ts";

export {
  createSapRelayServerState,
  attachHubEventFanout,
  handleRelayWsOpen,
  handleRelayWsClose,
  handleRelayWsMessage,
  type SapRelayServerState,
  type RelayWsData,
} from "./satellite-relay-server.ts";

export {
  installSapSharedWorkerHost,
  createSharedWorkerSapClient,
  type SharedWorkerPortMessage,
  type SapSharedWorkerInitConfig,
  type CreateSharedWorkerSapClientOptions,
} from "./shared-worker.ts";

export {
  hasNewAssistantReply,
  pollUntilAssistantReply,
  RECOVERY_INITIAL_DELAY_MS,
  RECOVERY_MAX_DELAY_MS,
  RECOVERY_MAX_DURATION_MS,
  type DisplayRecoveryItem,
} from "./display-recovery.ts";

/** @deprecated Use sidecar-client.ts */
export { createSapRelayBrowserClient as createSapRelayBrowserClientLegacy } from "./sidecar-client.ts";

/** @deprecated Use direct-client.ts */
export { createSapBrowserClient as createSapBrowserClientLegacy } from "./direct-client.ts";
