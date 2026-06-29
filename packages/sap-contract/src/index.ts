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
  CHAT_INSTANCE_ID,
  TASK_INSTANCE_ID,
  EMAIL_INSTANCE_ID,
  DIARY_INSTANCE_ID,
  NOTIFICATION_INSTANCE_ID,
} from "./satellite-instance.ts";

export {
  browserSapInstanceStore,
  memorySapInstanceStore,
  loadSapInstanceId,
  type SapInstanceStore,
} from "./instance-store.ts";
export {
  connectPayloadSchema,
  connectedPayloadSchema,
  heartbeatPayloadSchema,
} from "./frames/lifecycle.ts";
export type { ConnectPayload, ConnectedPayload, HeartbeatPayload } from "./frames/lifecycle.ts";

export {
  conversationCreateInputSchema,
  conversationCreateOutputSchema,
  conversationListInputSchema,
  conversationListOutputSchema,
  conversationMessagesInputSchema,
  conversationPatchTitleInputSchema,
  conversationArchiveInputSchema,
  conversationUnarchiveInputSchema,
  conversationDeleteInputSchema,
  conversationMutateOutputSchema,
  conversationSubscribeInputSchema,
  conversationUpdatedPayloadSchema,
  conversationCommandsInputSchema,
  conversationCommandsOutputSchema,
  conversationCommandItemSchema,
} from "./frames/conversation.ts";
export type {
  ConversationCreateInput,
  ConversationCreateOutput,
  ConversationListInput,
  ConversationListOutput,
  StoredMessagesInput,
  ConversationPatchTitleInput,
  ConversationArchiveInput,
  ConversationUnarchiveInput,
  ConversationDeleteInput,
  ConversationMutateOutput,
  ConversationSubscribeInput,
  ConversationUpdatedPayload,
  ConversationCommandsInput,
  ConversationCommandsOutput,
  ConversationCommandItem,
} from "./frames/conversation.ts";

export {
  sessionAcpDockInputSchema,
  sessionAcpDockOutputSchema,
  acpDockTaskSchema,
} from "./frames/acp.ts";
export type {
  ConversationAcpDockInput,
  ConversationAcpDockOutput,
  AcpDockTask,
} from "./frames/acp.ts";

export {
  fridgeListInputSchema,
  fridgeListOutputSchema,
  fridgeMagnetItemSchema,
} from "./frames/fridge.ts";
export type { FridgeListInput, FridgeListOutput, FridgeMagnetItem } from "./frames/fridge.ts";

export {
  taskListRowSchema,
  taskItemRowSchema,
  tasklistListInputSchema,
  tasklistListOutputSchema,
  tasklistCreateInputSchema,
  tasklistCreateOutputSchema,
  tasklistPatchInputSchema,
  tasklistPatchOutputSchema,
  tasklistDeleteInputSchema,
  tasklistDeleteOutputSchema,
  taskListInputSchema,
  taskListOutputSchema,
  taskCreateInputSchema,
  taskCreateOutputSchema,
  taskPatchInputSchema,
  taskPatchOutputSchema,
  taskCompleteInputSchema,
  taskCompleteOutputSchema,
  taskUncompleteInputSchema,
  taskUncompleteOutputSchema,
  taskDeleteInputSchema,
  taskDeleteOutputSchema,
} from "./frames/task.ts";
export type {
  TaskListRowPayload,
  TaskItemRowPayload,
  TasklistListInput,
  TasklistListOutput,
  TasklistCreateInput,
  TasklistCreateOutput,
  TasklistPatchInput,
  TasklistPatchOutput,
  TasklistDeleteInput,
  TasklistDeleteOutput,
  TaskListInput,
  TaskListOutput,
  TaskCreateInput,
  TaskCreateOutput,
  TaskPatchInput,
  TaskPatchOutput,
  TaskCompleteInput,
  TaskCompleteOutput,
  TaskUncompleteInput,
  TaskUncompleteOutput,
  TaskDeleteInput,
  TaskDeleteOutput,
} from "./frames/task.ts";

export {
  emailAccountRowSchema,
  emailMessageRowSchema,
  emailThreadRowSchema,
  emailAccountListInputSchema,
  emailAccountListOutputSchema,
  emailMessageListInputSchema,
  emailMessageListOutputSchema,
  emailMessageReadInputSchema,
  emailMessageReadOutputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageMarkReadOutputSchema,
  emailSyncInputSchema,
  emailSyncOutputSchema,
  emailThreadListInputSchema,
  emailThreadListOutputSchema,
} from "./frames/email.ts";
export type {
  EmailAccountRowPayload,
  EmailMessageRowPayload,
  EmailThreadRowPayload,
  EmailAccountListInput,
  EmailAccountListOutput,
  EmailMessageListInput,
  EmailMessageListOutput,
  EmailMessageReadInput,
  EmailMessageReadOutput,
  EmailMessageMarkReadInput,
  EmailMessageMarkReadOutput,
  EmailSyncInput,
  EmailSyncOutput,
  EmailThreadListInput,
  EmailThreadListOutput,
} from "./frames/email.ts";

export {
  notificationRecipientKindSchema,
  notificationReadFilterSchema,
  notificationSourceKindSchema,
  notificationRowSchema,
  notificationListInputSchema,
  notificationListOutputSchema,
  notificationMarkReadInputSchema,
  notificationMarkReadOutputSchema,
  notificationRecipientsOutputSchema,
} from "./frames/notification.ts";
export type {
  NotificationRecipientKind,
  NotificationReadFilter,
  NotificationSourceKind,
  NotificationRow,
  NotificationListInput,
  NotificationListOutput,
  NotificationMarkReadInput,
  NotificationMarkReadOutput,
  NotificationRecipientsOutput,
} from "./frames/notification.ts";

export {
  diaryEntryRowSchema,
  diaryListInputSchema,
  diaryListOutputSchema,
  diaryCreateInputSchema,
  diaryCreateOutputSchema,
  diaryAppendInputSchema,
  diaryAppendOutputSchema,
  diaryPatchInputSchema,
  diaryPatchOutputSchema,
  diaryDeleteInputSchema,
  diaryDeleteOutputSchema,
  diaryGetInputSchema,
  diaryGetOutputSchema,
  diarySearchInputSchema,
  diarySearchOutputSchema,
} from "./frames/diary.ts";
export type {
  DiaryEntryRowPayload,
  DiaryListInput,
  DiaryListOutput,
  DiaryCreateInput,
  DiaryCreateOutput,
  DiaryAppendInput,
  DiaryAppendOutput,
  DiaryPatchInput,
  DiaryPatchOutput,
  DiaryDeleteInput,
  DiaryDeleteOutput,
  DiaryGetInput,
  DiaryGetOutput,
  DiarySearchInput,
  DiarySearchOutput,
} from "./frames/diary.ts";

export {
  messageSendInputSchema,
  messageSendOutputSchema,
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  mapStreamApiEventToSap,
  mapRuntimeStreamEventToSap,
  mapSapStreamMethodToApi,
  streamEventMethods,
} from "./frames/message.ts";
export type {
  MessageSendInput,
  MessageSendOutput,
  MessageInterruptInput,
  MessageInterruptOutput,
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
  createSapConversationStreamClient,
  sapListConversations,
  sapCreateConversation,
  sapGetStoredMessages,
  sapPatchConversationTitle,
  type SubscribeCallbacks,
  type SapSessionStreamClient,
} from "./conversation-stream-core.ts";

export {
  createSapDirectClient,
  loadDirectSatelliteConfig,
  formatDirectPlatform,
  type DirectSatelliteConfig,
  type SapDirectClient,
  type SapDirectClientOptions,
} from "./direct-client.ts";

export {
  createSapSidecarClient,
  type SapConnectionState,
  type SapSidecarClient,
  type SapSidecarClientOptions,
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
