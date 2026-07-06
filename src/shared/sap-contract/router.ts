import type {
  MessageInterruptInput,
  MessageInterruptOutput,
  MessageSendInput,
  MessageSendOutput,
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
  ConversationCommandsInput,
  ConversationCommandsOutput,
} from "./frames/conversation.ts";
import type { ConversationAcpDockInput, ConversationAcpDockOutput } from "./frames/acp.ts";
import type {
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
} from "./frames/notification.ts";
import type {
  DiaryAppendInput,
  DiaryAppendOutput,
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
} from "./frames/diary.ts";
import type {
  DreamGetInput,
  DreamGetOutput,
  DreamListInput,
  DreamListOutput,
} from "./frames/dream.ts";
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
import type { SapAttachPayload, SapAttachOutput } from "./frames/lifecycle.ts";
import type {
  TerminalAttachInput,
  TerminalAttachOutput,
  TerminalCloseInput,
  TerminalResizeInput,
  TerminalWriteInput,
} from "./frames/terminal.ts";

export const SAP_METHODS = [
  "sap.attach",
  "sap.detach",
  "conversation.create",
  "conversation.list",
  "conversation.messages",
  "conversation.patchTitle",
  "conversation.archive",
  "conversation.unarchive",
  "conversation.delete",
  "conversation.rollbackBeforeLastUser",
  "conversation.subscribe",
  "conversation.acpDock",
  "conversation.commands",
  "message.send",
  "message.interrupt",
  "tasklist.list",
  "tasklist.create",
  "tasklist.patch",
  "tasklist.delete",
  "task.list",
  "task.create",
  "task.patch",
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
  "dream.list",
  "dream.get",
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
  "email.sync",
  "emailthread.list",
  "notification.list",
  "notification.markRead",
  "notification.recipients",
  "terminal.attach",
  "terminal.write",
  "terminal.resize",
  "terminal.close",
  "tool.register",
  "tool.unregister",
  "tool.result",
  "tool.error",
] as const;

export type SapMethod = (typeof SAP_METHODS)[number];

export type SapRouterInputs = {
  "sap.attach": SapAttachPayload;
  "sap.detach": Record<string, never>;
  "conversation.create": ConversationCreateInput;
  "conversation.list": ConversationListInput;
  "conversation.messages": StoredMessagesInput;
  "conversation.patchTitle": ConversationPatchTitleInput;
  "conversation.archive": ConversationArchiveInput;
  "conversation.unarchive": ConversationUnarchiveInput;
  "conversation.delete": ConversationDeleteInput;
  "conversation.rollbackBeforeLastUser": ConversationDeleteInput;
  "conversation.subscribe": ConversationSubscribeInput;
  "conversation.acpDock": ConversationAcpDockInput;
  "conversation.commands": ConversationCommandsInput;
  "message.send": MessageSendInput;
  "message.interrupt": MessageInterruptInput;
  "tasklist.list": TasklistListInput;
  "tasklist.create": TasklistCreateInput;
  "tasklist.patch": TasklistPatchInput;
  "tasklist.delete": TasklistDeleteInput;
  "task.list": TaskListInput;
  "task.create": TaskCreateInput;
  "task.patch": TaskPatchInput;
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
  "dream.list": DreamListInput;
  "dream.get": DreamGetInput;
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
  "email.sync": EmailSyncInput;
  "emailthread.list": EmailThreadListInput;
  "notification.list": NotificationListInput;
  "notification.markRead": NotificationMarkReadInput;
  "notification.recipients": Record<string, never>;
  "terminal.attach": TerminalAttachInput;
  "terminal.write": TerminalWriteInput;
  "terminal.resize": TerminalResizeInput;
  "terminal.close": TerminalCloseInput;
  "tool.register": ToolRegisterInput;
  "tool.unregister": ToolUnregisterInput;
  "tool.result": ToolResultInput;
  "tool.error": ToolErrorInput;
};

export type SapRouterOutputs = {
  "sap.attach": SapAttachOutput;
  "sap.detach": { ok: true };
  "conversation.create": ConversationCreateOutput;
  "conversation.list": ConversationListOutput;
  "conversation.messages": Record<string, unknown>;
  "conversation.patchTitle": { ok: true };
  "conversation.archive": ConversationMutateOutput;
  "conversation.unarchive": ConversationMutateOutput;
  "conversation.delete": ConversationMutateOutput;
  "conversation.rollbackBeforeLastUser": ConversationMutateOutput;
  "conversation.subscribe": { ok: true };
  "conversation.acpDock": ConversationAcpDockOutput;
  "conversation.commands": ConversationCommandsOutput;
  "message.send": MessageSendOutput;
  "message.interrupt": MessageInterruptOutput;
  "tasklist.list": TasklistListOutput;
  "tasklist.create": TasklistCreateOutput;
  "tasklist.patch": TasklistPatchOutput;
  "tasklist.delete": TasklistDeleteOutput;
  "task.list": TaskListOutput;
  "task.create": TaskCreateOutput;
  "task.patch": TaskPatchOutput;
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
  "dream.list": DreamListOutput;
  "dream.get": DreamGetOutput;
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
  "email.sync": EmailSyncOutput;
  "emailthread.list": EmailThreadListOutput;
  "notification.list": NotificationListOutput;
  "notification.markRead": NotificationMarkReadOutput;
  "notification.recipients": NotificationRecipientsOutput;
  "terminal.attach": TerminalAttachOutput;
  "terminal.write": { ok: true };
  "terminal.resize": { ok: true };
  "terminal.close": { ok: true };
  "tool.register": ToolRegisterOutput;
  "tool.unregister": { ok: true };
  "tool.result": { ok: true };
  "tool.error": { ok: true };
};

export type SapServerHandlers = {
  onSapAttach(payload: SapAttachPayload): SapAttachOutput | Promise<SapAttachOutput>;
  onSapDetach(appId: string, instanceId: string): void | Promise<void>;
  handle(
    method: SapMethod,
    payload: SapRouterInputs[SapMethod],
    ctx: SapRequestContext,
  ): Promise<SapRouterOutputs[SapMethod]> | SapRouterOutputs[SapMethod];
};

export type SapRequestAuthContext = {
  subject_id: number;
  subject_type: "user" | "agent";
  token_id: number;
  scopes: string[];
};

export type SapRequestContext = {
  app_id: string;
  instance_id: string;
  auth: SapRequestAuthContext;
  sendEvent(method: string, payload: unknown): void;
};

export function defineSapRouter(): {
  methods: readonly SapMethod[];
  isSapMethod(method: string): method is SapMethod;
} {
  return {
    methods: SAP_METHODS,
    isSapMethod(method: string): method is SapMethod {
      return (SAP_METHODS as readonly string[]).includes(method);
    },
  };
}

export type SapClient = {
  request<K extends SapMethod>(
    method: K,
    payload: SapRouterInputs[K],
    opts?: import("@freeanima/hub-rpc").RpcRequestOptions,
  ): Promise<SapRouterOutputs[K]>;
  onEvent(method: string, handler: (payload: unknown) => void): () => void;
  close(): void;
};
