/**
 * Remote-tools WS 帧级 router 类型（outpost attach 路径）。
 * 完整 Habitat method 列表与 transport meta 以 `@freeanima/host/platform/habitat/habitat-router` 为 SSOT。
 */
import type {
  MessageInterruptInput,
  MessageInterruptOutput,
  MessageSendInput,
  MessageSendOutput,
  StreamAttachInput,
  StreamAttachOutput,
  StreamLookupInput,
  StreamLookupOutput,
} from "./frames/message.ts";
import type {
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
  ConversationSubscribeInboxInput,
  ConversationMarkReadInput,
  ConversationMarkReadOutput,
  ConversationUnreadCountInput,
  ConversationUnreadCountOutput,
  ConversationCommandsInput,
  ConversationCommandsOutput,
  ConversationCommandInput,
  ConversationCommandOutput,
  ConversationTailInput,
  ConversationTailOutput,
} from "./frames/conversation.ts";
import type { ConversationAcpDockInput, ConversationAcpDockOutput } from "./frames/acp.ts";
import type {
  TasklistListInput,
  TasklistListOutput,
  TasklistStatsInput,
  TasklistStatsOutput,
  TasklistCreateInput,
  TasklistCreateOutput,
  TasklistPatchInput,
  TasklistPatchOutput,
  TasklistDeleteInput,
  TasklistDeleteOutput,
  TasklistItemListInput,
  TasklistItemListOutput,
  TasklistItemCreateInput,
  TasklistItemCreateOutput,
  ProjectItemListInput,
  ProjectItemListOutput,
  ProjectItemCreateInput,
  ProjectItemCreateOutput,
  SmartlistListInput,
  SmartlistListOutput,
  SmartlistStatsInput,
  SmartlistStatsOutput,
  SmartlistCreateInput,
  SmartlistCreateOutput,
  SmartlistPatchInput,
  SmartlistPatchOutput,
  SmartlistDeleteInput,
  SmartlistDeleteOutput,
  TaskMoveToListInput,
  TaskMoveToListOutput,
  TaskMoveToProjectInput,
  TaskMoveToProjectOutput,
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
import type {
  EmailAccountListInput,
  EmailAccountListOutput,
  EmailMessageListInput,
  EmailMessageListOutput,
  EmailMessageMarkReadInput,
  EmailMessageMarkReadOutput,
  EmailMessageReadInput,
  EmailMessageReadOutput,
  EmailMessageSearchInput,
  EmailMessageSearchOutput,
  EmailMessageMoveInput,
  EmailMessageMoveOutput,
  EmailMessageMarkFlaggedInput,
  EmailMessageMarkFlaggedOutput,
  EmailMessageMarkUnflaggedInput,
  EmailMessageMarkUnflaggedOutput,
  EmailMailboxListInput,
  EmailMailboxListOutput,
  EmailMailboxCreateInput,
  EmailMailboxCreateOutput,
  EmailMailboxRenameInput,
  EmailMailboxRenameOutput,
  EmailMailboxDeleteInput,
  EmailMailboxDeleteOutput,
  EmailDraftSaveInput,
  EmailDraftSaveOutput,
  EmailDraftSendInput,
  EmailDraftSendOutput,
  EmailSyncInput,
  EmailSyncOutput,
  EmailThreadListInput,
  EmailThreadListOutput,
} from "./frames/email.ts";
import type {
  NotificationListInput,
  NotificationListOutput,
  NotificationMarkReadInput,
  NotificationMarkReadOutput,
  NotificationRecipientsOutput,
  NotificationSubscribeInboxInput,
  NotificationSubscribeInboxOutput,
} from "./frames/notification.ts";
import type {
  DiaryAppendInput,
  DiaryAppendOutput,
  DiaryBlockCreateInput,
  DiaryBlockCreateOutput,
  DiaryBlockDeleteInput,
  DiaryBlockDeleteOutput,
  DiaryBlockPatchInput,
  DiaryBlockPatchOutput,
  DiaryBlockReorderInput,
  DiaryBlockReorderOutput,
  DiaryCreateInput,
  DiaryCreateOutput,
  DiaryDeleteInput,
  DiaryDeleteOutput,
  DiaryGetInput,
  DiaryGetOutput,
  DiaryListInput,
  DiaryListOutput,
  DiaryPatchInput,
  DiaryPatchOutput,
  DiarySearchInput,
  DiarySearchOutput,
  DiaryTemplateCreateInput,
  DiaryTemplateCreateOutput,
  DiaryTemplateDeleteInput,
  DiaryTemplateDeleteOutput,
  DiaryTemplateListInput,
  DiaryTemplateListOutput,
  DiaryTemplatePatchInput,
  DiaryTemplatePatchOutput,
  DiarySuggestTagsInput,
  DiarySuggestTagsOutput,
} from "./frames/diary.ts";
import type {
  CompanionConfigGetInput,
  CompanionConfigGetOutput,
  CompanionConfigUpdateInput,
  CompanionConfigUpdateOutput,
  CompanionMigrateFromLocalInput,
  CompanionMigrateFromLocalOutput,
  CompanionModelDeleteInput,
  CompanionModelDeleteOutput,
  CompanionModelRenameInput,
  CompanionModelRenameOutput,
  CompanionModelSetActiveInput,
  CompanionModelSetActiveOutput,
  CompanionMotionDeleteInput,
  CompanionMotionDeleteOutput,
  CompanionMotionRenameInput,
  CompanionMotionRenameOutput,
  CompanionMotionSetSlotInput,
  CompanionMotionSetSlotOutput,
  CompanionSyncPullInput,
  CompanionSyncPullOutput,
} from "./frames/companion.ts";
import type {
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
} from "./frames/vault.ts";
import type {
  ToolErrorInput,
  ToolRegisterInput,
  ToolRegisterOutput,
  ToolResultInput,
  ToolUnregisterInput,
} from "./frames/tool.ts";
import type { RemoteToolsAttachPayload, RemoteToolsAttachOutput } from "./frames/lifecycle.ts";
import type {
  TerminalAttachInput,
  TerminalAttachOutput,
  TerminalCloseInput,
  TerminalResizeInput,
  TerminalWriteInput,
} from "./frames/terminal.ts";

export const RPC_PROTOCOL_METHODS = [
  "remote_tools.attach",
  "remote_tools.detach",
  "conversation.create",
  "conversation.list",
  "conversation.messages",
  "conversation.tail",
  "conversation.patchTitle",
  "conversation.archive",
  "conversation.unarchive",
  "conversation.delete",
  "conversation.rollbackBeforeLastUser",
  "conversation.subscribe",
  "conversation.subscribeInbox",
  "conversation.markRead",
  "conversation.unreadCount",
  "conversation.acpDock",
  "conversation.commands",
  "conversation.command",
  "message.send",
  "message.interrupt",
  "stream.attach",
  "stream.lookup",
  "tasklist.list",
  "tasklist.stats",
  "tasklist.create",
  "tasklist.patch",
  "tasklist.delete",
  "tasklist.item.list",
  "tasklist.item.create",
  "smartlist.list",
  "smartlist.stats",
  "smartlist.create",
  "smartlist.patch",
  "smartlist.delete",
  "project.item.list",
  "project.item.create",
  "task.patch",
  "task.moveToProject",
  "task.moveToList",
  "task.complete",
  "task.uncomplete",
  "task.delete",
  "task.search",
  "diary.list",
  "diary.create",
  "diary.append",
  "diary.patch",
  "diary.delete",
  "diary.get",
  "diary.search",
  "diary.blockCreate",
  "diary.blockPatch",
  "diary.blockDelete",
  "diary.blockReorder",
  "diary.templateList",
  "diary.templateCreate",
  "diary.templatePatch",
  "diary.templateDelete",
  "diary.suggestTags",
  "vault.list",
  "vault.get",
  "vault.create",
  "vault.createPlain",
  "vault.patch",
  "vault.patchPlain",
  "vault.delete",
  "vault.search",
  "vault.crypto.get",
  "vault.crypto.init",
  "vault.crypto.change",
  "vault.ensureAgent",
  "emailaccount.list",
  "email.message.list",
  "email.message.read",
  "email.message.markRead",
  "email.message.search",
  "email.message.move",
  "email.message.markFlagged",
  "email.mailbox.list",
  "email.draft.save",
  "email.sync",
  "emailthread.list",
  "notification.list",
  "notification.markRead",
  "notification.recipients",
  "notification.subscribeInbox",
  "companion.config.get",
  "companion.config.update",
  "companion.model.setActive",
  "companion.model.rename",
  "companion.model.delete",
  "companion.motion.setSlot",
  "companion.motion.rename",
  "companion.motion.delete",
  "companion.migrate.fromLocal",
  "companion.sync.pull",
  "terminal.attach",
  "terminal.write",
  "terminal.resize",
  "terminal.close",
  "tool.register",
  "tool.unregister",
  "tool.result",
  "tool.error",
] as const;

export type RpcMethod = (typeof RPC_PROTOCOL_METHODS)[number];

export type RpcRouterInputs = {
  "remote_tools.attach": RemoteToolsAttachPayload;
  "remote_tools.detach": Record<string, never>;
  "conversation.create": ConversationCreateInput;
  "conversation.list": ConversationListInput;
  "conversation.messages": StoredMessagesInput;
  "conversation.tail": ConversationTailInput;
  "conversation.patchTitle": ConversationPatchTitleInput;
  "conversation.archive": ConversationArchiveInput;
  "conversation.unarchive": ConversationUnarchiveInput;
  "conversation.delete": ConversationDeleteInput;
  "conversation.rollbackBeforeLastUser": ConversationDeleteInput;
  "conversation.subscribe": ConversationSubscribeInput;
  "conversation.subscribeInbox": ConversationSubscribeInboxInput;
  "conversation.markRead": ConversationMarkReadInput;
  "conversation.unreadCount": ConversationUnreadCountInput;
  "conversation.acpDock": ConversationAcpDockInput;
  "conversation.commands": ConversationCommandsInput;
  "conversation.command": ConversationCommandInput;
  "message.send": MessageSendInput;
  "message.interrupt": MessageInterruptInput;
  "stream.attach": StreamAttachInput;
  "stream.lookup": StreamLookupInput;
  "tasklist.list": TasklistListInput;
  "tasklist.stats": TasklistStatsInput;
  "tasklist.create": TasklistCreateInput;
  "tasklist.patch": TasklistPatchInput;
  "tasklist.delete": TasklistDeleteInput;
  "tasklist.item.list": TasklistItemListInput;
  "tasklist.item.create": TasklistItemCreateInput;
  "smartlist.list": SmartlistListInput;
  "smartlist.stats": SmartlistStatsInput;
  "smartlist.create": SmartlistCreateInput;
  "smartlist.patch": SmartlistPatchInput;
  "smartlist.delete": SmartlistDeleteInput;
  "project.item.list": ProjectItemListInput;
  "project.item.create": ProjectItemCreateInput;
  "task.patch": TaskPatchInput;
  "task.moveToProject": TaskMoveToProjectInput;
  "task.moveToList": TaskMoveToListInput;
  "task.complete": TaskCompleteInput;
  "task.uncomplete": TaskUncompleteInput;
  "task.delete": TaskDeleteInput;
  "task.search": TaskSearchInput;
  "diary.list": DiaryListInput;
  "diary.create": DiaryCreateInput;
  "diary.append": DiaryAppendInput;
  "diary.patch": DiaryPatchInput;
  "diary.delete": DiaryDeleteInput;
  "diary.get": DiaryGetInput;
  "diary.search": DiarySearchInput;
  "diary.blockCreate": DiaryBlockCreateInput;
  "diary.blockPatch": DiaryBlockPatchInput;
  "diary.blockDelete": DiaryBlockDeleteInput;
  "diary.blockReorder": DiaryBlockReorderInput;
  "diary.templateList": DiaryTemplateListInput;
  "diary.templateCreate": DiaryTemplateCreateInput;
  "diary.templatePatch": DiaryTemplatePatchInput;
  "diary.templateDelete": DiaryTemplateDeleteInput;
  "diary.suggestTags": DiarySuggestTagsInput;
  "vault.list": VaultListInput;
  "vault.get": VaultGetInput;
  "vault.create": VaultCreateInput;
  "vault.createPlain": VaultCreatePlainInput;
  "vault.patch": VaultPatchInput;
  "vault.patchPlain": VaultPatchPlainInput;
  "vault.delete": VaultDeleteInput;
  "vault.search": VaultSearchInput;
  "vault.crypto.get": VaultCryptoGetInput;
  "vault.crypto.init": VaultCryptoInitInput;
  "vault.crypto.change": VaultCryptoChangeInput;
  "vault.ensureAgent": VaultEnsureAgentInput;
  "emailaccount.list": EmailAccountListInput;
  "email.message.list": EmailMessageListInput;
  "email.message.read": EmailMessageReadInput;
  "email.message.markRead": EmailMessageMarkReadInput;
  "email.message.search": EmailMessageSearchInput;
  "email.message.move": EmailMessageMoveInput;
  "email.message.markFlagged": EmailMessageMarkFlaggedInput;
  "email.message.markUnflagged": EmailMessageMarkUnflaggedInput;
  "email.mailbox.list": EmailMailboxListInput;
  "email.mailbox.create": EmailMailboxCreateInput;
  "email.mailbox.rename": EmailMailboxRenameInput;
  "email.mailbox.delete": EmailMailboxDeleteInput;
  "email.draft.save": EmailDraftSaveInput;
  "email.draft.send": EmailDraftSendInput;
  "email.sync": EmailSyncInput;
  "emailthread.list": EmailThreadListInput;
  "notification.list": NotificationListInput;
  "notification.markRead": NotificationMarkReadInput;
  "notification.recipients": Record<string, never>;
  "notification.subscribeInbox": NotificationSubscribeInboxInput;
  "companion.config.get": CompanionConfigGetInput;
  "companion.config.update": CompanionConfigUpdateInput;
  "companion.model.setActive": CompanionModelSetActiveInput;
  "companion.model.rename": CompanionModelRenameInput;
  "companion.model.delete": CompanionModelDeleteInput;
  "companion.motion.setSlot": CompanionMotionSetSlotInput;
  "companion.motion.rename": CompanionMotionRenameInput;
  "companion.motion.delete": CompanionMotionDeleteInput;
  "companion.migrate.fromLocal": CompanionMigrateFromLocalInput;
  "companion.sync.pull": CompanionSyncPullInput;
  "terminal.attach": TerminalAttachInput;
  "terminal.write": TerminalWriteInput;
  "terminal.resize": TerminalResizeInput;
  "terminal.close": TerminalCloseInput;
  "tool.register": ToolRegisterInput;
  "tool.unregister": ToolUnregisterInput;
  "tool.result": ToolResultInput;
  "tool.error": ToolErrorInput;
};

export type RpcRouterOutputs = {
  "remote_tools.attach": RemoteToolsAttachOutput;
  "remote_tools.detach": { ok: true };
  "conversation.create": ConversationCreateOutput;
  "conversation.list": ConversationListOutput;
  "conversation.messages": Record<string, unknown>;
  "conversation.tail": ConversationTailOutput;
  "conversation.patchTitle": { ok: true };
  "conversation.archive": ConversationMutateOutput;
  "conversation.unarchive": ConversationMutateOutput;
  "conversation.delete": ConversationMutateOutput;
  "conversation.rollbackBeforeLastUser": ConversationMutateOutput;
  "conversation.subscribe": { ok: true };
  "conversation.subscribeInbox": { ok: true };
  "conversation.markRead": ConversationMarkReadOutput;
  "conversation.unreadCount": ConversationUnreadCountOutput;
  "conversation.acpDock": ConversationAcpDockOutput;
  "conversation.commands": ConversationCommandsOutput;
  "conversation.command": ConversationCommandOutput;
  "message.send": MessageSendOutput;
  "message.interrupt": MessageInterruptOutput;
  "stream.attach": StreamAttachOutput;
  "stream.lookup": StreamLookupOutput;
  "tasklist.list": TasklistListOutput;
  "tasklist.stats": TasklistStatsOutput;
  "tasklist.create": TasklistCreateOutput;
  "tasklist.patch": TasklistPatchOutput;
  "tasklist.delete": TasklistDeleteOutput;
  "tasklist.item.list": TasklistItemListOutput;
  "tasklist.item.create": TasklistItemCreateOutput;
  "smartlist.list": SmartlistListOutput;
  "smartlist.stats": SmartlistStatsOutput;
  "smartlist.create": SmartlistCreateOutput;
  "smartlist.patch": SmartlistPatchOutput;
  "smartlist.delete": SmartlistDeleteOutput;
  "project.item.list": ProjectItemListOutput;
  "project.item.create": ProjectItemCreateOutput;
  "task.patch": TaskPatchOutput;
  "task.moveToProject": TaskMoveToProjectOutput;
  "task.moveToList": TaskMoveToListOutput;
  "task.complete": TaskCompleteOutput;
  "task.uncomplete": TaskUncompleteOutput;
  "task.delete": TaskDeleteOutput;
  "task.search": TaskSearchOutput;
  "diary.list": DiaryListOutput;
  "diary.create": DiaryCreateOutput;
  "diary.append": DiaryAppendOutput;
  "diary.patch": DiaryPatchOutput;
  "diary.delete": DiaryDeleteOutput;
  "diary.get": DiaryGetOutput;
  "diary.search": DiarySearchOutput;
  "diary.blockCreate": DiaryBlockCreateOutput;
  "diary.blockPatch": DiaryBlockPatchOutput;
  "diary.blockDelete": DiaryBlockDeleteOutput;
  "diary.blockReorder": DiaryBlockReorderOutput;
  "diary.templateList": DiaryTemplateListOutput;
  "diary.templateCreate": DiaryTemplateCreateOutput;
  "diary.templatePatch": DiaryTemplatePatchOutput;
  "diary.templateDelete": DiaryTemplateDeleteOutput;
  "diary.suggestTags": DiarySuggestTagsOutput;
  "vault.list": VaultListOutput;
  "vault.get": VaultGetOutput;
  "vault.create": VaultCreateOutput;
  "vault.createPlain": VaultCreatePlainOutput;
  "vault.patch": VaultPatchOutput;
  "vault.patchPlain": VaultPatchPlainOutput;
  "vault.delete": VaultDeleteOutput;
  "vault.search": VaultSearchOutput;
  "vault.crypto.get": VaultCryptoGetOutput;
  "vault.crypto.init": VaultCryptoInitOutput;
  "vault.crypto.change": VaultCryptoChangeOutput;
  "vault.ensureAgent": VaultEnsureAgentOutput;
  "emailaccount.list": EmailAccountListOutput;
  "email.message.list": EmailMessageListOutput;
  "email.message.read": EmailMessageReadOutput;
  "email.message.markRead": EmailMessageMarkReadOutput;
  "email.message.search": EmailMessageSearchOutput;
  "email.message.move": EmailMessageMoveOutput;
  "email.message.markFlagged": EmailMessageMarkFlaggedOutput;
  "email.message.markUnflagged": EmailMessageMarkUnflaggedOutput;
  "email.mailbox.list": EmailMailboxListOutput;
  "email.mailbox.create": EmailMailboxCreateOutput;
  "email.mailbox.rename": EmailMailboxRenameOutput;
  "email.mailbox.delete": EmailMailboxDeleteOutput;
  "email.draft.save": EmailDraftSaveOutput;
  "email.draft.send": EmailDraftSendOutput;
  "email.sync": EmailSyncOutput;
  "emailthread.list": EmailThreadListOutput;
  "notification.list": NotificationListOutput;
  "notification.markRead": NotificationMarkReadOutput;
  "notification.recipients": NotificationRecipientsOutput;
  "notification.subscribeInbox": NotificationSubscribeInboxOutput;
  "companion.config.get": CompanionConfigGetOutput;
  "companion.config.update": CompanionConfigUpdateOutput;
  "companion.model.setActive": CompanionModelSetActiveOutput;
  "companion.model.rename": CompanionModelRenameOutput;
  "companion.model.delete": CompanionModelDeleteOutput;
  "companion.motion.setSlot": CompanionMotionSetSlotOutput;
  "companion.motion.rename": CompanionMotionRenameOutput;
  "companion.motion.delete": CompanionMotionDeleteOutput;
  "companion.migrate.fromLocal": CompanionMigrateFromLocalOutput;
  "companion.sync.pull": CompanionSyncPullOutput;
  "terminal.attach": TerminalAttachOutput;
  "terminal.write": { ok: true };
  "terminal.resize": { ok: true };
  "terminal.close": { ok: true };
  "tool.register": ToolRegisterOutput;
  "tool.unregister": { ok: true };
  "tool.result": { ok: true };
  "tool.error": { ok: true };
};

export type RemoteToolsServerHandlers = {
  onRemoteToolsAttach(
    payload: RemoteToolsAttachPayload,
  ): RemoteToolsAttachOutput | Promise<RemoteToolsAttachOutput>;
  onRemoteToolsDetach(appId: string, instanceId: string): void | Promise<void>;
  handle(
    method: RpcMethod,
    payload: RpcRouterInputs[RpcMethod],
    ctx: RemoteToolsRequestContext,
  ): Promise<RpcRouterOutputs[RpcMethod]> | RpcRouterOutputs[RpcMethod];
};

export type RpcRequestAuthContext = {
  subject_id: number;
  subject_type: "user" | "agent";
  token_id: number;
  scopes: string[];
};

export type RemoteToolsRequestContext = {
  app_id: string;
  instance_id: string;
  auth: RpcRequestAuthContext;
  sendEvent(method: string, payload: unknown): void;
};

export function defineRpcProtocolRouter(): {
  methods: readonly RpcMethod[];
  isRpcMethod(method: string): method is RpcMethod;
} {
  return {
    methods: RPC_PROTOCOL_METHODS,
    isRpcMethod(method: string): method is RpcMethod {
      return (RPC_PROTOCOL_METHODS as readonly string[]).includes(method);
    },
  };
}

export type RpcStreamClient = {
  request<K extends RpcMethod>(
    method: K,
    payload: RpcRouterInputs[K],
    opts?: import("@freeanima/shared/habitat-rpc").RpcRequestOptions,
  ): Promise<RpcRouterOutputs[K]>;
  onEvent(method: string, handler: (payload: unknown) => void): () => void;
  close(): void;
};
