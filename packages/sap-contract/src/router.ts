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
  ConversationSubscribeInput,
  ConversationCommandsInput,
  ConversationCommandsOutput,
} from "./frames/conversation.ts";
import type { ConversationAcpDockInput, ConversationAcpDockOutput } from "./frames/acp.ts";
import type { FridgeListInput, FridgeListOutput } from "./frames/fridge.ts";
import type {
  ToolErrorInput,
  ToolRegisterInput,
  ToolRegisterOutput,
  ToolResultInput,
  ToolUnregisterInput,
} from "./frames/tool.ts";
import type { ConnectPayload, ConnectedPayload } from "./frames/lifecycle.ts";
import type {
  TerminalAttachInput,
  TerminalAttachOutput,
  TerminalCloseInput,
  TerminalResizeInput,
  TerminalWriteInput,
} from "./frames/terminal.ts";

export const SAP_METHODS = [
  "conversation.create",
  "conversation.list",
  "conversation.messages",
  "conversation.patchTitle",
  "conversation.subscribe",
  "conversation.acpDock",
  "conversation.commands",
  "message.send",
  "message.interrupt",
  "fridge.list",
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
  "conversation.create": ConversationCreateInput;
  "conversation.list": ConversationListInput;
  "conversation.messages": StoredMessagesInput;
  "conversation.patchTitle": ConversationPatchTitleInput;
  "conversation.subscribe": ConversationSubscribeInput;
  "conversation.acpDock": ConversationAcpDockInput;
  "conversation.commands": ConversationCommandsInput;
  "message.send": MessageSendInput;
  "message.interrupt": MessageInterruptInput;
  "fridge.list": FridgeListInput;
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
  "conversation.create": ConversationCreateOutput;
  "conversation.list": ConversationListOutput;
  "conversation.messages": Record<string, unknown>;
  "conversation.patchTitle": { ok: true };
  "conversation.subscribe": { ok: true };
  "conversation.acpDock": ConversationAcpDockOutput;
  "conversation.commands": ConversationCommandsOutput;
  "message.send": MessageSendOutput;
  "message.interrupt": MessageInterruptOutput;
  "fridge.list": FridgeListOutput;
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
  onConnect(payload: ConnectPayload): ConnectedPayload | Promise<ConnectedPayload>;
  onDisconnect(appId: string, instanceId: string): void | Promise<void>;
  handle(
    method: SapMethod,
    payload: SapRouterInputs[SapMethod],
    ctx: SapRequestContext,
  ): Promise<SapRouterOutputs[SapMethod]> | SapRouterOutputs[SapMethod];
};

export type SapRequestContext = {
  app_id: string;
  instance_id: string;
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
  connect(payload: Omit<ConnectPayload, "protocol">): Promise<ConnectedPayload>;
  request<K extends SapMethod>(
    method: K,
    payload: SapRouterInputs[K],
  ): Promise<SapRouterOutputs[K]>;
  onEvent(method: string, handler: (payload: unknown) => void): () => void;
  close(): void;
};
