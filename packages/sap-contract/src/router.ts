import type { MessageSendInput, MessageSendOutput } from "./frames/message.ts";
import type {
  SessionCreateInput,
  SessionCreateOutput,
  SessionListInput,
  SessionListOutput,
  SessionMessagesInput,
  SessionPatchTitleInput,
  SessionSubscribeInput,
  SessionCommandsInput,
  SessionCommandsOutput,
} from "./frames/session.ts";
import type { SessionAcpDockInput, SessionAcpDockOutput } from "./frames/acp.ts";
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
  "session.create",
  "session.list",
  "session.messages",
  "session.patchTitle",
  "session.subscribe",
  "session.acpDock",
  "session.commands",
  "message.send",
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
  "session.create": SessionCreateInput;
  "session.list": SessionListInput;
  "session.messages": SessionMessagesInput;
  "session.patchTitle": SessionPatchTitleInput;
  "session.subscribe": SessionSubscribeInput;
  "session.acpDock": SessionAcpDockInput;
  "session.commands": SessionCommandsInput;
  "message.send": MessageSendInput;
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
  "session.create": SessionCreateOutput;
  "session.list": SessionListOutput;
  "session.messages": Record<string, unknown>;
  "session.patchTitle": { ok: true };
  "session.subscribe": { ok: true };
  "session.acpDock": SessionAcpDockOutput;
  "session.commands": SessionCommandsOutput;
  "message.send": MessageSendOutput;
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
