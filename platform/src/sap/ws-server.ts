import type { SapServerDeps } from "./types.ts";
export type { SapServerDeps } from "./types.ts";
import {
  handleNotificationList,
  handleNotificationMarkRead,
  handleNotificationRecipients,
} from "./handlers/notification.ts";
import {
  handleTasklistList,
  handleTasklistCreate,
  handleTasklistPatch,
  handleTasklistDelete,
  handleTaskList,
  handleTaskCreate,
  handleTaskPatch,
  handleTaskComplete,
  handleTaskUncomplete,
  handleTaskDelete,
} from "./handlers/entity-task.ts";
import {
  connectPayloadSchema,
  defineSapRouter,
  parseSapEnvelope,
  SAP_VERSION,
  serializeSapEnvelope,
  conversationCreateInputSchema,
  conversationListInputSchema,
  conversationMessagesInputSchema,
  conversationPatchTitleInputSchema,
  conversationArchiveInputSchema,
  conversationUnarchiveInputSchema,
  conversationDeleteInputSchema,
  conversationSubscribeInputSchema,
  sessionAcpDockInputSchema,
  conversationCommandsInputSchema,
  fridgeListInputSchema,
  diaryListInputSchema,
  diaryCreateInputSchema,
  diaryAppendInputSchema,
  diaryPatchInputSchema,
  diaryDeleteInputSchema,
  diaryGetInputSchema,
  diarySearchInputSchema,
  emailAccountListInputSchema,
  emailMessageListInputSchema,
  emailMessageReadInputSchema,
  emailMessageMarkReadInputSchema,
  emailSyncInputSchema,
  emailThreadListInputSchema,
  messageSendInputSchema,
  messageInterruptInputSchema,
  toolRegisterInputSchema,
  toolUnregisterInputSchema,
  toolResultInputSchema,
  toolErrorInputSchema,
  terminalAttachInputSchema,
  terminalWriteInputSchema,
  terminalResizeInputSchema,
  terminalCloseInputSchema,
  normalizeAppSlug,
  formatSapPlatform,
  type SapMethod,
  type SapRequestContext,
  type SapRouterInputs,
  type SapServerHandlers,
  type SapRouterOutputs,
} from "@freeanima/sap-contract";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { bridgeMessageStream, bridgeSessionUpdates } from "./stream-bridge.ts";
import * as serviceSessions from "../runtime/service-conversations.ts";
import * as serviceAcpDock from "../runtime/service-acp-dock.ts";
import * as serviceStatus from "../runtime/service-status.ts";
import * as serviceFridge from "../runtime/service-fridge.ts";
import * as serviceEntityDiary from "../runtime/service-entity-diary.ts";
import * as serviceEntityEmail from "../runtime/service-entity-email.ts";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  TerminalSessionError,
} from "./terminal-session.ts";
import { verifyRemoteAuthToken } from "../../admin-api/remote-auth.ts";

const HEARTBEAT_INTERVAL_SEC = 30;

type SapWsSend = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export function createSapServerHandlers(
  deps: SapServerDeps,
  sessionPumps: Map<string, AbortController>,
): SapServerHandlers {
  const router = defineSapRouter();

  const handlers: SapServerHandlers = {
    async onConnect(payload) {
      const parsed = connectPayloadSchema.parse(payload);
      const resolved = await deps.instanceRegistry.resolveConnect({
        appId: parsed.app_id,
        instanceId: parsed.instance_id,
        httpUrl: parsed.http_url,
      });
      if (!resolved.ok) {
        throw new Error(resolved.error);
      }
      const wantsMaskPresets = parsed.features_requested.includes("capability_mask");
      return {
        protocol: SAP_VERSION,
        instance_id: resolved.instanceId,
        features_enabled: parsed.features_requested,
        server_info: {
          anima_version: deps.animaVersion,
          sap_version: SAP_VERSION,
          ...(wantsMaskPresets
            ? {
                capability_mask: {
                  presets: deps.masks.list().map((entry) => ({
                    name: entry.name,
                    allowed_tools_summary: entry.mask.allowed_tools.slice(0, 32),
                  })),
                },
              }
            : {}),
        },
        heartbeat_interval_sec: HEARTBEAT_INTERVAL_SEC,
      };
    },

    async onDisconnect(appId, instanceId) {
      deps.satelliteManager.unregisterAllTools(appId, instanceId);
    },

    async handle(method, payload, ctx) {
      if (!router.isSapMethod(method)) {
        throw new Error(`unknown SAP method: ${method}`);
      }

      switch (method) {
        case "conversation.create": {
          const input = conversationCreateInputSchema.parse(payload);
          const platform = input.platform ?? formatSapPlatform(ctx.app_id, ctx.instance_id);
          const platformExtra: Record<string, unknown> = {
            satellite_app_id: normalizeAppSlug(ctx.app_id),
            satellite_instance_id: ctx.instance_id,
          };
          if (input.workspace_root) platformExtra.workspace_root = input.workspace_root;
          if (input.workspace_gitignore !== undefined) {
            platformExtra.workspace_gitignore = input.workspace_gitignore;
          }
          if (input.workspace_show_hidden !== undefined) {
            platformExtra.workspace_show_hidden = input.workspace_show_hidden;
          }
          if (input.capability_mask) {
            platformExtra.capability_mask = input.capability_mask;
          }
          const sid = await deps.runtime.conversation.newConversation(
            platform,
            undefined,
            platformExtra,
          );
          if (input.title?.trim()) {
            await deps.runtime.setConversationTitle(sid, input.title.trim(), platform);
          }
          return { conversation_id: sid };
        }
        case "conversation.list": {
          const input = conversationListInputSchema.parse(payload);
          const platform = input.platform ?? formatSapPlatform(ctx.app_id, ctx.instance_id);
          const result = await serviceSessions.listConversations(
            deps.runtime.runtimeDeps(),
            platform ?? null,
            { includeArchived: input.include_archived },
          );
          return {
            conversations: result.conversations.map((s) => ({
              conversation_id: s.id,
              title: s.title,
              platform: s.platform,
              updated_at: s.created_at,
              archived_at: s.archived_at ?? null,
            })),
          };
        }
        case "conversation.messages": {
          const input = conversationMessagesInputSchema.parse(payload);
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          const messages = await deps.runtime.getMessages(input.conversation_id, platform, {
            offset: input.offset,
            limit: input.limit,
          });
          return messages as SapRouterOutputs["conversation.messages"];
        }
        case "conversation.patchTitle": {
          const input = conversationPatchTitleInputSchema.parse(payload);
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          await deps.runtime.setConversationTitle(input.conversation_id, input.title, platform);
          return { ok: true as const };
        }
        case "conversation.archive": {
          const input = conversationArchiveInputSchema.parse(payload);
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          await deps.runtime.archiveConversation(input.conversation_id, platform);
          return { ok: true as const };
        }
        case "conversation.unarchive": {
          const input = conversationUnarchiveInputSchema.parse(payload);
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          await deps.runtime.unarchiveConversation(input.conversation_id, platform);
          return { ok: true as const };
        }
        case "conversation.delete": {
          const input = conversationDeleteInputSchema.parse(payload);
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          await deps.runtime.deleteConversation(input.conversation_id, platform);
          return { ok: true as const };
        }
        case "conversation.subscribe": {
          const input = conversationSubscribeInputSchema.parse(payload);
          const pumpKey = `${ctx.app_id}:${ctx.instance_id}:${input.conversation_id}`;
          if (!sessionPumps.has(pumpKey)) {
            const controller = new AbortController();
            sessionPumps.set(pumpKey, controller);
            void pumpSessionUpdates(deps, ctx, input.conversation_id, controller.signal).finally(
              () => {
                sessionPumps.delete(pumpKey);
              },
            );
          }
          return { ok: true as const };
        }
        case "conversation.acpDock": {
          const input = sessionAcpDockInputSchema.parse(payload);
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          return serviceAcpDock.getConversationAcpDock(
            deps.runtime.runtimeDeps(),
            input.conversation_id,
            platform,
          );
        }
        case "conversation.commands": {
          const input = conversationCommandsInputSchema.parse(payload);
          const platform = input.platform ?? formatSapPlatform(ctx.app_id, ctx.instance_id);
          return serviceStatus.listCommands({
            platform: input.all ? undefined : platform,
            all: input.all,
          });
        }
        case "fridge.list": {
          fridgeListInputSchema.parse(payload);
          return serviceFridge.listFridgeMagnets();
        }
        case "tasklist.list":
          return handleTasklistList(deps, payload);
        case "tasklist.create":
          return handleTasklistCreate(deps, payload);
        case "tasklist.patch":
          return handleTasklistPatch(deps, payload);
        case "tasklist.delete":
          return handleTasklistDelete(deps, payload);
        case "task.list":
          return handleTaskList(deps, payload);
        case "task.create":
          return handleTaskCreate(deps, payload);
        case "task.patch":
          return handleTaskPatch(deps, payload);
        case "task.complete":
          return handleTaskComplete(deps, payload);
        case "task.uncomplete":
          return handleTaskUncomplete(deps, payload);
        case "task.delete":
          return handleTaskDelete(deps, payload);
        case "diary.list": {
          const input = diaryListInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiaryList(deps.runtime.runtimeDeps(), input);
        }
        case "diary.create": {
          const input = diaryCreateInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiaryCreate(deps.runtime.runtimeDeps(), input);
        }
        case "diary.append": {
          const input = diaryAppendInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiaryAppend(deps.runtime.runtimeDeps(), input);
        }
        case "diary.patch": {
          const input = diaryPatchInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiaryPatch(deps.runtime.runtimeDeps(), input);
        }
        case "diary.delete": {
          const input = diaryDeleteInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiaryDelete(deps.runtime.runtimeDeps(), input);
        }
        case "diary.get": {
          const input = diaryGetInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiaryGet(deps.runtime.runtimeDeps(), input);
        }
        case "diary.search": {
          const input = diarySearchInputSchema.parse(payload);
          return serviceEntityDiary.serviceDiarySearch(deps.runtime.runtimeDeps(), input);
        }
        case "emailaccount.list": {
          const input = emailAccountListInputSchema.parse(payload ?? {});
          return serviceEntityEmail.serviceEmailAccountList(deps.runtime.runtimeDeps(), input);
        }
        case "email.message.list": {
          const input = emailMessageListInputSchema.parse(payload);
          return serviceEntityEmail.serviceEmailMessageList(deps.runtime.runtimeDeps(), input);
        }
        case "email.message.read": {
          const input = emailMessageReadInputSchema.parse(payload);
          return serviceEntityEmail.serviceEmailMessageRead(deps.runtime.runtimeDeps(), input);
        }
        case "email.message.markRead": {
          const input = emailMessageMarkReadInputSchema.parse(payload);
          return serviceEntityEmail.serviceEmailMessageMarkRead(deps.runtime.runtimeDeps(), input);
        }
        case "email.sync": {
          const input = emailSyncInputSchema.parse(payload);
          return serviceEntityEmail.serviceEmailSync(deps.runtime.runtimeDeps(), input);
        }
        case "emailthread.list": {
          const input = emailThreadListInputSchema.parse(payload);
          return serviceEntityEmail.serviceEmailThreadList(deps.runtime.runtimeDeps(), input);
        }
        case "notification.list":
          return handleNotificationList(deps, payload);
        case "notification.markRead":
          return handleNotificationMarkRead(deps, payload);
        case "notification.recipients":
          return handleNotificationRecipients(deps);
        case "message.send": {
          const input = messageSendInputSchema.parse(payload);
          const streamId = crypto.randomUUID();
          const platform = await resolveConversationPlatform(deps, input.conversation_id);
          void pumpMessageStream(
            deps,
            ctx,
            streamId,
            input.conversation_id,
            input.message,
            platform,
          );
          return { stream_id: streamId };
        }
        case "message.interrupt": {
          const input = messageInterruptInputSchema.parse(payload);
          deps.runtime.interruptSessionStream(input.conversation_id);
          return { ok: true as const };
        }
        case "terminal.attach": {
          const input = terminalAttachInputSchema.parse(payload);
          const { conversationId, pty } = createTerminalSession(input.cwd);
          pty.onData((data) => {
            ctx.sendEvent("terminal.output", { terminal_id: conversationId, data });
          });
          pty.onExit((code) => {
            ctx.sendEvent("terminal.exit", { terminal_id: conversationId, code });
            closeTerminalSession(conversationId);
          });
          ctx.sendEvent("terminal.ready", { terminal_id: conversationId, conversationId });
          return { terminal_id: conversationId };
        }
        case "terminal.write": {
          const input = terminalWriteInputSchema.parse(payload);
          const pty = getTerminalSession(input.terminal_id);
          if (!pty) throw new TerminalSessionError();
          pty.write(input.data);
          return { ok: true as const };
        }
        case "terminal.resize": {
          const input = terminalResizeInputSchema.parse(payload);
          const pty = getTerminalSession(input.terminal_id);
          if (!pty) throw new TerminalSessionError();
          pty.resize(input.cols, input.rows);
          return { ok: true as const };
        }
        case "terminal.close": {
          const input = terminalCloseInputSchema.parse(payload);
          closeTerminalSession(input.terminal_id);
          return { ok: true as const };
        }
        case "tool.register": {
          const input = toolRegisterInputSchema.parse(payload);
          const registered = deps.satelliteManager.registerTools(
            ctx.app_id,
            ctx.instance_id,
            input.tools,
            { private: input.private },
          );
          return { registered };
        }
        case "tool.unregister": {
          const input = toolUnregisterInputSchema.parse(payload);
          deps.satelliteManager.unregisterTools(ctx.app_id, ctx.instance_id, input.local_names);
          return { ok: true as const };
        }
        case "tool.result": {
          const input = toolResultInputSchema.parse(payload);
          deps.satelliteManager.handleToolResult(input.call_id, input.content);
          return { ok: true as const };
        }
        case "tool.error": {
          const input = toolErrorInputSchema.parse(payload);
          deps.satelliteManager.handleToolError(input.call_id, input.error);
          return { ok: true as const };
        }
        default: {
          const _exhaustive: never = method;
          throw new Error(`unhandled SAP method: ${String(_exhaustive)}`);
        }
      }
    },
  };

  return handlers;
}

async function resolveConversationPlatform(
  deps: SapServerDeps,
  conversationId: string,
): Promise<string> {
  const meta = await deps.runtime.conversation.loadConversationMeta(conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  const platform = typeof p === "string" ? p.trim() : "";
  if (!platform) {
    throw new Error(`conversation ${conversationId.slice(0, 16)} has no platform`);
  }
  return platform;
}

async function pumpMessageStream(
  deps: SapServerDeps,
  ctx: SapRequestContext,
  streamId: string,
  conversationId: string,
  message: string,
  platform: string,
): Promise<void> {
  try {
    for await (const mapped of bridgeMessageStream(
      streamId,
      deps.runtime.sendMessageStream(conversationId, message, platform),
    )) {
      ctx.sendEvent(mapped.method, mapped.payload);
    }
  } catch (e) {
    ctx.sendEvent("stream.error", {
      stream_id: streamId,
      error: String(e),
    });
    ctx.sendEvent("stream.done", { stream_id: streamId });
  }
}

async function pumpSessionUpdates(
  deps: SapServerDeps,
  ctx: SapRequestContext,
  conversationId: string,
  signal: AbortSignal,
): Promise<void> {
  for await (const mapped of bridgeSessionUpdates(
    conversationId,
    (cb) => deps.runtime.watchConversation(conversationId, cb),
    signal,
  )) {
    if (signal.aborted) break;
    ctx.sendEvent(mapped.method, mapped.payload);
  }
}

export function attachSapWebSocket(
  deps: SapServerDeps,
  ws: SapWsSend,
  opts: { bypassRemoteAuth?: boolean } = {},
): { close: () => void; handleMessage: (raw: string) => Promise<void> } {
  const sessionPumps = new Map<string, AbortController>();
  const handlers = createSapServerHandlers(deps, sessionPumps);
  let connected = false;
  let connState: { appId: string; instanceId: string } | null = null;
  let satelliteConnKey = "";

  const sendEnvelope = (envelope: Parameters<typeof serializeSapEnvelope>[0]): void => {
    ws.send(serializeSapEnvelope(envelope));
  };

  const ctxFor = (): SapRequestContext => ({
    app_id: connState?.appId ?? "",
    instance_id: connState?.instanceId ?? "",
    sendEvent(method, payload) {
      sendEnvelope({ kind: "evt", method, payload });
    },
  });

  const handleMessage = async (raw: string): Promise<void> => {
    let envelope: ReturnType<typeof parseSapEnvelope>;
    try {
      envelope = parseSapEnvelope(raw);
    } catch {
      ws.close(1003, "invalid frame");
      return;
    }

    if (envelope.kind === "connect") {
      if (connected) {
        ws.close(1008, "already connected");
        return;
      }
      const parsed = connectPayloadSchema.parse(envelope.payload);
      if (
        !opts.bypassRemoteAuth &&
        !verifyRemoteAuthToken(deps.remoteAuthToken, parsed.auth_token)
      ) {
        ws.close(1008, "unauthorized");
        return;
      }
      let connectedPayload: Awaited<ReturnType<SapServerHandlers["onConnect"]>>;
      try {
        connectedPayload = await handlers.onConnect(parsed);
      } catch (e) {
        ws.close(1008, e instanceof Error ? e.message : String(e));
        return;
      }
      const instanceId = connectedPayload.instance_id;
      connState = { appId: parsed.app_id, instanceId };
      connected = true;
      satelliteConnKey = deps.satelliteManager.connectionKey(parsed.app_id, instanceId);
      deps.satelliteManager.registerConnection(
        satelliteConnKey,
        {
          appId: parsed.app_id,
          instanceId,
          sendEvent(method, payload) {
            sendEnvelope({ kind: "evt", method, payload });
          },
          sendRequest: async () => {
            throw new Error("satellite sendRequest not implemented on hub");
          },
        },
        { httpUrl: parsed.http_url },
      );
      sendEnvelope({ kind: "connected", payload: connectedPayload });
      return;
    }

    if (!connected || !connState) {
      ws.close(1008, "not connected");
      return;
    }

    if (envelope.kind === "evt" && envelope.method === "heartbeat") {
      deps.satelliteManager.touchHeartbeat(connState.appId, connState.instanceId);
      sendEnvelope({ kind: "evt", method: "heartbeat", payload: { ts: Date.now() } });
      return;
    }

    if (envelope.kind === "req") {
      try {
        const result = await handlers.handle(
          envelope.method as SapMethod,
          envelope.payload as SapRouterInputs[SapMethod],
          ctxFor(),
        );
        sendEnvelope({
          kind: "res",
          id: envelope.id,
          ok: true,
          payload: result,
        });
      } catch (e) {
        sendEnvelope({
          kind: "res",
          id: envelope.id,
          ok: false,
          error: {
            code: "sap_error",
            message: e instanceof Error ? e.message : String(e),
          },
        });
      }
    }
  };

  return {
    close() {
      for (const controller of sessionPumps.values()) {
        controller.abort();
      }
      sessionPumps.clear();
      if (connState) {
        void handlers.onDisconnect(connState.appId, connState.instanceId);
        deps.satelliteManager.unregisterConnection(satelliteConnKey);
      }
    },
    handleMessage,
  };
}
