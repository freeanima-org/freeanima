import { randomPublicId } from "@freeanima/shared/util";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsServerDeps } from "./types.ts";
export type { RemoteToolsServerDeps } from "./types.ts";
import { bindVaultShellSendRequest } from "@freeanima/habitat/capabilities/connectors/vault";
import { bindChatSessionPumps } from "@freeanima/features/chat/habitat/session-pumps";
import { bindNotificationSessionPumps } from "@freeanima/features/notification/habitat/session-pumps";
import { bindTaskSessionPumps } from "@freeanima/features/task/habitat/session-pumps";
import {
  remoteToolsAttachPayloadSchema,
  defineRpcProtocolRouter,
  type RpcMethod,
  type RpcRequestAuthContext,
  type RemoteToolsRequestContext,
  type RpcRouterInputs,
  type RemoteToolsServerHandlers,
} from "@freeanima/shared/rpc-contract";
import {
  habitatRpcConnectPayloadSchema,
  HABITAT_RPC_VERSION,
  parseHabitatRpcEnvelope,
  serializeHabitatRpcEnvelope,
  type HabitatRpcEnvelope,
} from "@freeanima/shared/habitat-rpc";
import { verifyServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import { isHabitatMethod } from "@freeanima/shared/habitat-contract";
import { getFeatureRpcHandler } from "@freeanima/habitat/platform/features/registry.ts";
import { habitatDispatch } from "@freeanima/habitat/platform/habitat/dispatch.ts";

const HEARTBEAT_INTERVAL_SEC = 30;
const SATELLITE_REQUEST_TIMEOUT_MS = 30_000;

type RemoteToolsWsSend = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export function createRemoteToolsServerHandlers(
  deps: RemoteToolsServerDeps,
  sessionPumps: Map<string, AbortController>,
): RemoteToolsServerHandlers {
  bindChatSessionPumps(sessionPumps);
  bindNotificationSessionPumps(sessionPumps);
  bindTaskSessionPumps(sessionPumps);
  const router = defineRpcProtocolRouter();

  const handlers: RemoteToolsServerHandlers = {
    async onRemoteToolsAttach(payload) {
      const parsed = remoteToolsAttachPayloadSchema.parse(payload);
      const resolved = await deps.instanceRegistry.resolveConnect(
        omitUndefined({
          appId: parsed.app_id,
          instanceId: parsed.instance_id,
          httpUrl: parsed.http_url,
        }),
      );
      if (!resolved.ok) {
        throw new Error(resolved.error);
      }
      return {
        instance_id: resolved.instanceId,
        features_enabled: parsed.features_requested,
        server_info: {
          anima_version: deps.animaVersion,
          habitat_rpc_version: HABITAT_RPC_VERSION,
        },
      };
    },

    async onRemoteToolsDetach(appId, instanceId) {
      deps.remoteToolsManager.unregisterAllTools(appId, instanceId);
    },

    async handle(method, payload, ctx) {
      if (isHabitatMethod(method)) {
        const featureHandler = getFeatureRpcHandler(method);
        if (featureHandler) {
          return habitatDispatch(deps, method, payload, ctx) as Promise<
            import("@freeanima/shared/rpc-contract").RpcRouterOutputs[typeof method]
          >;
        }
      }

      if (!router.isRpcMethod(method)) {
        throw new Error(`unknown remote-tools method: ${String(method)}`);
      }

      switch (method) {
        case "remote_tools.attach":
        case "remote_tools.detach":
          throw new Error("sap session methods are handled by Habitat RPC transport");
        default:
          throw new Error(`unknown remote-tools method: ${method}`);
      }
    },
  };

  return handlers;
}

export function attachSapWebSocket(
  deps: RemoteToolsServerDeps,
  ws: RemoteToolsWsSend,
): { close: () => void; handleMessage: (raw: string) => Promise<void> } {
  const sessionPumps = new Map<string, AbortController>();
  const handlers = createRemoteToolsServerHandlers(deps, sessionPumps);
  let rpcConnected = false;
  let hubSessionId: string | null = null;
  let connSapState: { appId: string; instanceId: string } | null = null;
  let connAuth: RpcRequestAuthContext | null = null;
  let satelliteConnKey = "";
  const satellitePendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const sendEnvelope = (envelope: HabitatRpcEnvelope): void => {
    ws.send(serializeHabitatRpcEnvelope(envelope));
  };

  const createRemoteToolsSendRequest = () => {
    return async (method: string, payload: unknown): Promise<unknown> => {
      const id = randomPublicId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!satellitePendingRequests.has(id)) return;
          satellitePendingRequests.delete(id);
          reject(new Error(`outpost request timed out: ${method}`));
        }, SATELLITE_REQUEST_TIMEOUT_MS);
        satellitePendingRequests.set(id, { resolve, reject, timer });
        sendEnvelope({ kind: "req", id, method, payload: payload ?? {} });
      });
    };
  };

  const ctxFor = (): RemoteToolsRequestContext => ({
    app_id: connSapState?.appId ?? "",
    instance_id: connSapState?.instanceId ?? "",
    auth: connAuth ?? {
      subject_id: 0,
      subject_type: "user",
      token_id: 0,
      scopes: [],
    },
    sendEvent(method, payload) {
      sendEnvelope({ kind: "evt", method, payload });
    },
  });

  const unregisterSapSession = (): void => {
    if (!connSapState) return;
    void handlers.onRemoteToolsDetach(connSapState.appId, connSapState.instanceId);
    deps.remoteToolsManager.unregisterConnection(satelliteConnKey);
    bindVaultShellSendRequest(null);
    connSapState = null;
    satelliteConnKey = "";
  };

  const handleMessage = async (raw: string): Promise<void> => {
    let envelope: HabitatRpcEnvelope;
    try {
      envelope = parseHabitatRpcEnvelope(raw);
    } catch {
      ws.close(1003, "invalid frame");
      return;
    }

    if (envelope.kind === "connect") {
      if (rpcConnected) {
        ws.close(1008, "already connected");
        return;
      }
      const parsed = habitatRpcConnectPayloadSchema.parse(envelope.payload);
      const verified = await verifyServiceApiToken(parsed.auth_token.trim());
      if (!verified) {
        ws.close(1008, "unauthorized");
        return;
      }
      connAuth = verified;
      rpcConnected = true;
      hubSessionId = randomPublicId();
      deps.hubSessionRegistry.register(hubSessionId, {
        auth: verified,
        sendEvent(method, payload) {
          sendEnvelope({ kind: "evt", method, payload });
        },
      });
      sendEnvelope({
        kind: "connected",
        payload: {
          protocol: HABITAT_RPC_VERSION,
          session_id: hubSessionId,
          heartbeat_interval_sec: HEARTBEAT_INTERVAL_SEC,
        },
      });
      return;
    }

    if (!rpcConnected || !connAuth) {
      ws.close(1008, "not connected");
      return;
    }

    if (envelope.kind === "res") {
      const pending = satellitePendingRequests.get(envelope.id);
      if (pending) {
        satellitePendingRequests.delete(envelope.id);
        clearTimeout(pending.timer);
        if (envelope.ok) {
          pending.resolve(envelope.payload);
        } else {
          pending.reject(new Error(envelope.error.message));
        }
        return;
      }
    }

    if (envelope.kind === "evt" && envelope.method === "heartbeat") {
      if (connSapState) {
        deps.remoteToolsManager.touchHeartbeat(connSapState.appId, connSapState.instanceId);
      }
      sendEnvelope({ kind: "evt", method: "heartbeat", payload: { ts: Date.now() } });
      return;
    }

    if (envelope.kind === "req") {
      if (envelope.method === "remote_tools.attach") {
        if (connSapState) {
          sendEnvelope({
            kind: "res",
            id: envelope.id,
            ok: false,
            error: {
              code: "outpost_already_attached",
              message: "remote-tools session already attached",
            },
          });
          return;
        }
        try {
          const attachPayload = remoteToolsAttachPayloadSchema.parse(envelope.payload);
          const attached = await handlers.onRemoteToolsAttach(attachPayload);
          connSapState = { appId: attachPayload.app_id, instanceId: attached.instance_id };
          satelliteConnKey = deps.remoteToolsManager.connectionKey(
            attachPayload.app_id,
            attached.instance_id,
          );
          const sendRequest = createRemoteToolsSendRequest();
          bindVaultShellSendRequest(sendRequest);
          deps.remoteToolsManager.registerConnection(
            satelliteConnKey,
            {
              appId: attachPayload.app_id,
              instanceId: attached.instance_id,
              sendEvent(method, payload) {
                sendEnvelope({ kind: "evt", method, payload });
              },
              sendRequest,
            },
            omitUndefined({ httpUrl: attachPayload.http_url }),
          );
          sendEnvelope({
            kind: "res",
            id: envelope.id,
            ok: true,
            payload: attached,
          });
        } catch (e) {
          sendEnvelope({
            kind: "res",
            id: envelope.id,
            ok: false,
            error: {
              code: "outpost_attach_error",
              message: e instanceof Error ? e.message : String(e),
            },
          });
        }
        return;
      }

      if (envelope.method === "remote_tools.detach") {
        try {
          unregisterSapSession();
          sendEnvelope({
            kind: "res",
            id: envelope.id,
            ok: true,
            payload: { ok: true as const },
          });
        } catch (e) {
          sendEnvelope({
            kind: "res",
            id: envelope.id,
            ok: false,
            error: {
              code: "outpost_detach_error",
              message: e instanceof Error ? e.message : String(e),
            },
          });
        }
        return;
      }

      if (envelope.method.startsWith("tool.") && !connSapState) {
        sendEnvelope({
          kind: "res",
          id: envelope.id,
          ok: false,
          error: {
            code: "outpost_not_attached",
            message: "remote-tools session not attached; call remote_tools.attach first",
          },
        });
        return;
      }

      try {
        const result = await handlers.handle(
          envelope.method as RpcMethod,
          envelope.payload as RpcRouterInputs[RpcMethod],
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
            code: "habitat_rpc_error",
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
      if (hubSessionId) {
        deps.hubSessionRegistry.unregister(hubSessionId);
        hubSessionId = null;
      }
      unregisterSapSession();
    },
    handleMessage,
  };
}
