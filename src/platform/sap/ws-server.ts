import { randomUUID } from "node:crypto";
import { omitUndefined } from "@freeanima/core/util";
import type { SapServerDeps } from "./types.ts";
export type { SapServerDeps } from "./types.ts";
import { bindVaultShellSendRequest } from "@freeanima/platform/connectors/vault";
import { bindChatSessionPumps } from "@freeanima/features/chat/hub/session-pumps";
import {
  sapAttachPayloadSchema,
  defineSapRouter,
  parseSapEnvelope,
  serializeSapEnvelope,
  type SapMethod,
  type SapRequestAuthContext,
  type SapRequestContext,
  type SapRouterInputs,
  type SapServerHandlers,
} from "@freeanima/shared/sap-contract";
import { hubRpcConnectPayloadSchema, HUB_RPC_VERSION } from "@freeanima/shared/hub-rpc";
import { verifyServiceApiToken } from "@freeanima/core/db/pg/service-api-token";
import { isHubMethod } from "@freeanima/shared/hub-contract";
import { getFeatureRpcHandler } from "../features/registry.ts";
import { hubDispatch } from "../hub/dispatch.ts";

const HEARTBEAT_INTERVAL_SEC = 30;
const SATELLITE_REQUEST_TIMEOUT_MS = 30_000;

type SapWsSend = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export function createSapServerHandlers(
  deps: SapServerDeps,
  sessionPumps: Map<string, AbortController>,
): SapServerHandlers {
  bindChatSessionPumps(sessionPumps);
  const router = defineSapRouter();

  const handlers: SapServerHandlers = {
    async onSapAttach(payload) {
      const parsed = sapAttachPayloadSchema.parse(payload);
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
      const wantsMaskPresets = parsed.features_requested.includes("capability_mask");
      return {
        instance_id: resolved.instanceId,
        features_enabled: parsed.features_requested,
        server_info: {
          anima_version: deps.animaVersion,
          hub_rpc_version: "HubRPC/1.0",
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
      };
    },

    async onSapDetach(appId, instanceId) {
      deps.satelliteManager.unregisterAllTools(appId, instanceId);
    },

    async handle(method, payload, ctx) {
      if (isHubMethod(method)) {
        const featureHandler = getFeatureRpcHandler(method);
        if (featureHandler) {
          return hubDispatch(deps, method, payload, ctx) as Promise<
            import("@freeanima/shared/sap-contract").SapRouterOutputs[typeof method]
          >;
        }
      }

      if (!router.isSapMethod(method)) {
        throw new Error(`unknown SAP method: ${method}`);
      }

      switch (method) {
        case "sap.attach":
        case "sap.detach":
          throw new Error("sap session methods are handled by Hub RPC transport");
        default:
          throw new Error(`unknown SAP method: ${String(method)}`);
      }
    },
  };

  return handlers;
}

export function attachSapWebSocket(
  deps: SapServerDeps,
  ws: SapWsSend,
): { close: () => void; handleMessage: (raw: string) => Promise<void> } {
  const sessionPumps = new Map<string, AbortController>();
  const handlers = createSapServerHandlers(deps, sessionPumps);
  let rpcConnected = false;
  let connSapState: { appId: string; instanceId: string } | null = null;
  let connAuth: SapRequestAuthContext | null = null;
  let satelliteConnKey = "";
  const satellitePendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const sendEnvelope = (envelope: Parameters<typeof serializeSapEnvelope>[0]): void => {
    ws.send(serializeSapEnvelope(envelope));
  };

  const createSatelliteSendRequest = () => {
    return async (method: string, payload: unknown): Promise<unknown> => {
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!satellitePendingRequests.has(id)) return;
          satellitePendingRequests.delete(id);
          reject(new Error(`satellite request timed out: ${method}`));
        }, SATELLITE_REQUEST_TIMEOUT_MS);
        satellitePendingRequests.set(id, { resolve, reject, timer });
        sendEnvelope({ kind: "req", id, method, payload: payload ?? {} });
      });
    };
  };

  const ctxFor = (): SapRequestContext => ({
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
    void handlers.onSapDetach(connSapState.appId, connSapState.instanceId);
    deps.satelliteManager.unregisterConnection(satelliteConnKey);
    bindVaultShellSendRequest(null);
    connSapState = null;
    satelliteConnKey = "";
  };

  const handleMessage = async (raw: string): Promise<void> => {
    let envelope: ReturnType<typeof parseSapEnvelope>;
    try {
      envelope = parseSapEnvelope(raw);
    } catch {
      ws.close(1003, "invalid frame");
      return;
    }

    if (envelope.kind === "connect") {
      if (rpcConnected) {
        ws.close(1008, "already connected");
        return;
      }
      const parsed = hubRpcConnectPayloadSchema.parse(envelope.payload);
      const verified = await verifyServiceApiToken(parsed.auth_token.trim());
      if (!verified) {
        ws.close(1008, "unauthorized");
        return;
      }
      connAuth = verified;
      rpcConnected = true;
      sendEnvelope({
        kind: "connected",
        payload: {
          protocol: HUB_RPC_VERSION,
          session_id: randomUUID(),
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
        deps.satelliteManager.touchHeartbeat(connSapState.appId, connSapState.instanceId);
      }
      sendEnvelope({ kind: "evt", method: "heartbeat", payload: { ts: Date.now() } });
      return;
    }

    if (envelope.kind === "req") {
      if (envelope.method === "sap.attach") {
        if (connSapState) {
          sendEnvelope({
            kind: "res",
            id: envelope.id,
            ok: false,
            error: { code: "sap_already_attached", message: "SAP session already attached" },
          });
          return;
        }
        try {
          const attachPayload = sapAttachPayloadSchema.parse(envelope.payload);
          const attached = await handlers.onSapAttach(attachPayload);
          connSapState = { appId: attachPayload.app_id, instanceId: attached.instance_id };
          satelliteConnKey = deps.satelliteManager.connectionKey(
            attachPayload.app_id,
            attached.instance_id,
          );
          const sendRequest = createSatelliteSendRequest();
          bindVaultShellSendRequest(sendRequest);
          deps.satelliteManager.registerConnection(
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
              code: "sap_attach_error",
              message: e instanceof Error ? e.message : String(e),
            },
          });
        }
        return;
      }

      if (envelope.method === "sap.detach") {
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
              code: "sap_detach_error",
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
            code: "sap_not_attached",
            message: "SAP session not attached; call sap.attach first",
          },
        });
        return;
      }

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
            code: "hub_rpc_error",
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
      unregisterSapSession();
    },
    handleMessage,
  };
}
