export {
  SAP_VERSION,
  parseSapEnvelope,
  serializeSapEnvelope,
  hubRpcConnectPayloadSchema,
  hubRpcConnectedPayloadSchema,
  HUB_RPC_VERSION,
} from "./protocol.ts";
export type { SapEnvelope, SapError } from "./protocol.ts";
export { randomUuid } from "@freeanima/kernel/random-uuid.ts";

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
  sapAttachPayloadSchema,
  sapAttachOutputSchema,
  sapDetachPayloadSchema,
  sapDetachOutputSchema,
  heartbeatPayloadSchema,
} from "./frames/lifecycle.ts";
export type {
  SapAttachPayload,
  SapAttachOutput,
  SapDetachPayload,
  SapDetachOutput,
  HeartbeatPayload,
} from "./frames/lifecycle.ts";

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
  conversationCommandInputSchema,
  conversationCommandOutputSchema,
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
  ConversationCommandInput,
  ConversationCommandOutput,
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
  taskListRowSchema,
  taskItemRowSchema,
  taskItemSearchFiltersSchema,
  smartListRowSchema,
  tasklistListInputSchema,
  tasklistListOutputSchema,
  tasklistCreateInputSchema,
  tasklistCreateOutputSchema,
  tasklistPatchInputSchema,
  tasklistPatchOutputSchema,
  tasklistDeleteInputSchema,
  tasklistDeleteOutputSchema,
  smartlistListInputSchema,
  smartlistListOutputSchema,
  smartlistCreateInputSchema,
  smartlistCreateOutputSchema,
  smartlistPatchInputSchema,
  smartlistPatchOutputSchema,
  smartlistDeleteInputSchema,
  smartlistDeleteOutputSchema,
  taskListInputSchema,
  taskListOutputSchema,
  tasklistItemListInputSchema,
  tasklistItemListOutputSchema,
  tasklistItemCreateInputSchema,
  tasklistItemCreateOutputSchema,
  projectItemListInputSchema,
  projectItemListOutputSchema,
  projectItemCreateInputSchema,
  projectItemCreateOutputSchema,
  taskCreateInputSchema,
  taskCreateOutputSchema,
  taskMoveToProjectInputSchema,
  taskMoveToProjectOutputSchema,
  taskMoveToListInputSchema,
  taskMoveToListOutputSchema,
  taskPatchInputSchema,
  taskPatchOutputSchema,
  taskCompleteInputSchema,
  taskCompleteOutputSchema,
  taskUncompleteInputSchema,
  taskUncompleteOutputSchema,
  taskDeleteInputSchema,
  taskDeleteOutputSchema,
  taskSearchInputSchema,
  taskSearchOutputSchema,
} from "./frames/task.ts";
export type {
  TaskListRowPayload,
  TaskItemRowPayload,
  TaskItemSearchFiltersPayload,
  SmartListRowPayload,
  TasklistListInput,
  TasklistListOutput,
  TasklistCreateInput,
  TasklistCreateOutput,
  TasklistPatchInput,
  TasklistPatchOutput,
  TasklistDeleteInput,
  TasklistDeleteOutput,
  SmartlistListInput,
  SmartlistListOutput,
  SmartlistCreateInput,
  SmartlistCreateOutput,
  SmartlistPatchInput,
  SmartlistPatchOutput,
  SmartlistDeleteInput,
  SmartlistDeleteOutput,
  TaskListInput,
  TaskListOutput,
  TasklistItemListInput,
  TasklistItemListOutput,
  TasklistItemCreateInput,
  TasklistItemCreateOutput,
  ProjectItemListInput,
  ProjectItemListOutput,
  ProjectItemCreateInput,
  ProjectItemCreateOutput,
  TaskCreateInput,
  TaskCreateOutput,
  TaskMoveToProjectInput,
  TaskMoveToProjectOutput,
  TaskMoveToListInput,
  TaskMoveToListOutput,
  TaskPatchInput,
  TaskPatchOutput,
  TaskCompleteInput,
  TaskCompleteOutput,
  TaskUncompleteInput,
  TaskUncompleteOutput,
  TaskDeleteInput,
  TaskDeleteOutput,
  TaskSearchInput,
  TaskSearchOutput,
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
  emailMessageSearchInputSchema,
  emailMessageSearchOutputSchema,
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
  EmailMessageSearchInput,
  EmailMessageSearchOutput,
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
  dreamEntryRowSchema,
  dreamListInputSchema,
  dreamListOutputSchema,
  dreamGetInputSchema,
  dreamGetOutputSchema,
} from "./frames/dream.ts";
export type {
  DreamEntryRowPayload,
  DreamListInput,
  DreamListOutput,
  DreamGetInput,
  DreamGetOutput,
} from "./frames/dream.ts";

export {
  vaultItemTypeSchema,
  vaultItemMetaRowSchema,
  vaultItemRowSchema,
  vaultItemDetailRowSchema,
  vaultSecretsViewSchema,
  vaultConfigRowSchema,
  vaultListInputSchema,
  vaultListOutputSchema,
  vaultGetInputSchema,
  vaultGetOutputSchema,
  vaultCreateInputSchema,
  vaultCreateOutputSchema,
  vaultCreatePlainInputSchema,
  vaultCreatePlainOutputSchema,
  vaultPatchInputSchema,
  vaultPatchOutputSchema,
  vaultPatchPlainInputSchema,
  vaultPatchPlainOutputSchema,
  vaultDeleteInputSchema,
  vaultDeleteOutputSchema,
  vaultSearchInputSchema,
  vaultSearchOutputSchema,
  vaultCryptoGetInputSchema,
  vaultCryptoGetOutputSchema,
  vaultCryptoInitInputSchema,
  vaultCryptoInitOutputSchema,
  vaultCryptoChangeInputSchema,
  vaultCryptoChangeOutputSchema,
  vaultEnsureAgentInputSchema,
  vaultEnsureAgentOutputSchema,
  vaultResolveSecretUserInputSchema,
  vaultResolveSecretUserOutputSchema,
} from "./frames/vault.ts";
export type {
  VaultItemMetaRowPayload,
  VaultItemRowPayload,
  VaultItemDetailRowPayload,
  VaultSecretsViewPayload,
  VaultConfigRowPayload,
  VaultListInput,
  VaultListOutput,
  VaultGetInput,
  VaultGetOutput,
  VaultCreateInput,
  VaultCreateOutput,
  VaultCreatePlainInput,
  VaultCreatePlainOutput,
  VaultPatchInput,
  VaultPatchOutput,
  VaultPatchPlainInput,
  VaultPatchPlainOutput,
  VaultDeleteInput,
  VaultDeleteOutput,
  VaultSearchInput,
  VaultSearchOutput,
  VaultCryptoGetInput,
  VaultCryptoGetOutput,
  VaultCryptoInitInput,
  VaultCryptoInitOutput,
  VaultCryptoChangeInput,
  VaultCryptoChangeOutput,
  VaultEnsureAgentInput,
  VaultEnsureAgentOutput,
  VaultResolveSecretUserInput,
  VaultResolveSecretUserOutput,
} from "./frames/vault.ts";

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
  SapRequestAuthContext,
  SapRequestContext,
  SapClient,
} from "./router.ts";

export {
  resolveHubHttpUrl,
  resolveHubWsUrl,
  resolveHubRpcWsUrl,
  hubHttpFromWsUrl,
  hubHttpFromRpcWsUrl,
  resolveRelayWsUrl,
} from "./urls.ts";

export {
  getBundledSapStreamClient,
  whenBundledSapClientReady,
  createBundledSapStreamClient,
  resetBundledSapStreamClientForTests,
  subscribeShellConfigChanges,
} from "./bundled-sap-stream.ts";
export type { BundledSapStreamClient, SapConnectionState } from "./bundled-sap-stream.ts";

export { sapClientFromRpc } from "./sap-client-from-rpc.ts";

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
  loadDirectSatelliteConfig,
  formatDirectPlatform,
  defaultChatPlatform,
  type DirectSatelliteConfig,
} from "./satellite-config.ts";

export {
  createSapSidecarClient,
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
  hasNewAssistantReply,
  pollUntilAssistantReply,
  RECOVERY_INITIAL_DELAY_MS,
  RECOVERY_MAX_DELAY_MS,
  RECOVERY_MAX_DURATION_MS,
  type DisplayRecoveryItem,
} from "./display-recovery.ts";
