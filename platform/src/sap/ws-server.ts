import type { AppRuntime } from "../runtime/app-runtime.ts";
import type { SatelliteManager } from "@freeanima/capabilities-satellite";
import {
  connectPayloadSchema,
  defineSapRouter,
  parseSapEnvelope,
  SAP_VERSION,
  serializeSapEnvelope,
  sessionCreateInputSchema,
  sessionListInputSchema,
  sessionMessagesInputSchema,
  sessionPatchTitleInputSchema,
  sessionSubscribeInputSchema,
  messageSendInputSchema,
  toolRegisterInputSchema,
  toolUnregisterInputSchema,
  toolResultInputSchema,
  toolErrorInputSchema,
  terminalAttachInputSchema,
  terminalWriteInputSchema,
  terminalResizeInputSchema,
  terminalCloseInputSchema,
  normalizeAppSlug,
  resolvePlatformForApp,
  type SapMethod,
  type SapRequestContext,
  type SapRouterInputs,
  type SapServerHandlers,
  type SapRouterOutputs,
} from "@freeanima/sap-contract";
import { isSessionMeta } from "@freeanima/core/db/domain";
import { bridgeMessageStream, bridgeSessionUpdates } from "./stream-bridge.ts";
import * as serviceSessions from "../runtime/service-sessions.ts";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  TerminalSessionError,
} from "../../connectors/webui/elysia/terminal-session.ts";

const HEARTBEAT_INTERVAL_SEC = 30;

export type SapServerDeps = {
  runtime: AppRuntime;
  satelliteManager: SatelliteManager;
  animaVersion: string;
};

type SapWsSend = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export function createSapServerHandlers(deps: SapServerDeps): SapServerHandlers {
  const router = defineSapRouter();

  const handlers: SapServerHandlers = {
    onConnect(payload) {
      const parsed = connectPayloadSchema.parse(payload);
      return {
        protocol: SAP_VERSION,
        features_enabled: parsed.features_requested,
        server_info: {
          anima_version: deps.animaVersion,
          sap_version: SAP_VERSION,
          platform_for_app: {
            "pair-programming": "studio-pair-programming",
            parlor: "parlor",
          },
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
        case "session.create": {
          const input = sessionCreateInputSchema.parse(payload);
          const platform =
            input.platform ?? resolvePlatformForApp(ctx.app_id) ?? "studio-pair-programming";
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
          const sid = await deps.runtime.conversation.newSession(
            platform,
            undefined,
            platformExtra,
          );
          if (input.title?.trim()) {
            await deps.runtime.setSessionTitle(sid, input.title.trim(), platform);
          }
          return { session_id: sid };
        }
        case "session.list": {
          const input = sessionListInputSchema.parse(payload);
          const platform = input.platform ?? resolvePlatformForApp(ctx.app_id) ?? undefined;
          const result = await serviceSessions.listSessions(
            deps.runtime.runtimeDeps(),
            platform ?? null,
          );
          return {
            sessions: result.sessions.map((s) => ({
              session_id: s.id,
              title: s.title,
              platform: s.platform,
              updated_at: s.created,
            })),
          };
        }
        case "session.messages": {
          const input = sessionMessagesInputSchema.parse(payload);
          const platform = await resolveSessionPlatform(deps, input.session_id);
          const messages = await deps.runtime.getMessages(input.session_id, platform, {
            offset: input.offset,
            limit: input.limit,
          });
          return messages as SapRouterOutputs["session.messages"];
        }
        case "session.patchTitle": {
          const input = sessionPatchTitleInputSchema.parse(payload);
          const platform = await resolveSessionPlatform(deps, input.session_id);
          await deps.runtime.setSessionTitle(input.session_id, input.title, platform);
          return { ok: true as const };
        }
        case "session.subscribe": {
          const input = sessionSubscribeInputSchema.parse(payload);
          void pumpSessionUpdates(deps, ctx, input.session_id);
          return { ok: true as const };
        }
        case "message.send": {
          const input = messageSendInputSchema.parse(payload);
          const streamId = crypto.randomUUID();
          const platform = await resolveSessionPlatform(deps, input.session_id);
          void pumpMessageStream(deps, ctx, streamId, input.session_id, input.message, platform);
          return { stream_id: streamId };
        }
        case "terminal.attach": {
          const input = terminalAttachInputSchema.parse(payload);
          const { sessionId, pty } = createTerminalSession(input.cwd);
          pty.onData((data) => {
            ctx.sendEvent("terminal.output", { terminal_id: sessionId, data });
          });
          pty.onExit((code) => {
            ctx.sendEvent("terminal.exit", { terminal_id: sessionId, code });
            closeTerminalSession(sessionId);
          });
          ctx.sendEvent("terminal.ready", { terminal_id: sessionId, sessionId });
          return { terminal_id: sessionId };
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

async function resolveSessionPlatform(deps: SapServerDeps, sessionId: string): Promise<string> {
  const meta = await deps.runtime.conversation.loadSessionMeta(sessionId);
  const p = isSessionMeta(meta) ? meta.platform : undefined;
  return typeof p === "string" && p ? p : "parlor";
}

async function pumpMessageStream(
  deps: SapServerDeps,
  ctx: SapRequestContext,
  streamId: string,
  sessionId: string,
  message: string,
  platform: string,
): Promise<void> {
  try {
    for await (const mapped of bridgeMessageStream(
      streamId,
      deps.runtime.sendMessageStream(sessionId, message, platform),
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
  sessionId: string,
): Promise<void> {
  const controller = new AbortController();
  for await (const mapped of bridgeSessionUpdates(
    sessionId,
    (cb) => deps.runtime.watchSession(sessionId, cb),
    controller.signal,
  )) {
    ctx.sendEvent(mapped.method, mapped.payload);
  }
}

export function attachSapWebSocket(
  deps: SapServerDeps,
  ws: SapWsSend,
): { close: () => void; handleMessage: (raw: string) => Promise<void> } {
  const handlers = createSapServerHandlers(deps);
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
      const connectedPayload = await handlers.onConnect(parsed);
      connState = { appId: parsed.app_id, instanceId: parsed.instance_id };
      connected = true;
      satelliteConnKey = deps.satelliteManager.connectionKey(parsed.app_id, parsed.instance_id);
      deps.satelliteManager.registerConnection(
        satelliteConnKey,
        {
          appId: parsed.app_id,
          instanceId: parsed.instance_id,
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
      if (connState) {
        void handlers.onDisconnect(connState.appId, connState.instanceId);
        deps.satelliteManager.unregisterConnection(satelliteConnKey);
      }
    },
    handleMessage,
  };
}
