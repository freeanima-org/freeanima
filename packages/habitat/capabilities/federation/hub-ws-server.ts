import {
  federationHandshakeAckSchema,
  federationHandshakeHelloSchema,
  federationPingInputSchema,
  federationPingOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/federation.ts";
import {
  getTrustedSatellite,
  upsertPendingSatellite,
} from "@freeanima/habitat/core/db/pg/federation";
import type { FederationIdentityMaterial } from "./handshake.ts";
import {
  createHubAck,
  encodeFederationFrame,
  federationPingMessage,
  federationPongMessage,
  parseFederationFrame,
  verifyHelloSignature,
} from "./handshake.ts";
import type { FederationHubSessionRegistry } from "./hub-session-registry.ts";

export type FederationHubWsDeps = {
  getHubIdentity: () => FederationIdentityMaterial | null;
  hubRegistry: FederationHubSessionRegistry;
  isHubEnabled: () => boolean;
};

type WsSend = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export function attachFederationHubWebSocket(
  deps: FederationHubWsDeps,
  ws: WsSend,
): { handleMessage(raw: string): Promise<void>; close(): void } {
  let sessionId: string | null = null;
  let closed = false;

  const closeSession = (code?: number, reason?: string) => {
    if (closed) return;
    closed = true;
    if (sessionId) deps.hubRegistry.unregister(sessionId);
    ws.close(code, reason);
  };

  return {
    async handleMessage(raw) {
      if (closed) return;
      const frame = parseFederationFrame(raw);
      if (!frame) {
        closeSession(4400, "invalid frame");
        return;
      }

      if (frame.method === "federation.handshake") {
        if (!deps.isHubEnabled()) {
          closeSession(4403, "hub federation disabled");
          return;
        }
        const parsed = federationHandshakeHelloSchema.safeParse(frame.payload);
        if (!parsed.success) {
          closeSession(4400, "invalid hello");
          return;
        }
        const hello = parsed.data;
        if (!verifyHelloSignature(hello)) {
          closeSession(4401, "invalid signature");
          return;
        }
        const existing = await getTrustedSatellite(hello.habitat_instance_id);
        let trust_state: "trusted" | "pending";
        if (existing?.status === "trusted") {
          if (existing.satellite_public_key !== hello.public_key) {
            closeSession(4403, "public key mismatch");
            return;
          }
          trust_state = "trusted";
        } else {
          try {
            await upsertPendingSatellite({
              satellite_habitat_instance_id: hello.habitat_instance_id,
              satellite_public_key: hello.public_key,
            });
          } catch {
            closeSession(4403, "trust request rejected");
            return;
          }
          trust_state = "pending";
        }
        const hubIdentity = deps.getHubIdentity();
        if (!hubIdentity) {
          closeSession(4503, "hub identity missing");
          return;
        }
        const ack = createHubAck({
          hub: hubIdentity,
          echo_nonce: hello.nonce,
          trust_state,
        });
        ws.send(encodeFederationFrame("federation.handshake.ack", ack));
        sessionId = hello.habitat_instance_id;
        deps.hubRegistry.register({
          habitat_instance_id: hello.habitat_instance_id,
          public_key: hello.public_key,
          connected_at: new Date(),
          trust_state,
          send: (data) => ws.send(data),
          close: (code, reason) => closeSession(code, reason),
        });
        return;
      }

      if (!sessionId) {
        closeSession(4401, "handshake required");
        return;
      }

      const session = deps.hubRegistry.get(sessionId);
      const isTrustedSession = session?.trust_state === "trusted";

      if (frame.method === "federation.ping") {
        const parsed = federationPingInputSchema.safeParse(frame.payload ?? {});
        if (!parsed.success) {
          closeSession(4400, "invalid ping");
          return;
        }
        const message = federationPingMessage(parsed.data.message);
        const output = federationPingOutputSchema.parse({
          pong: federationPongMessage(message),
          habitat_instance_id: deps.getHubIdentity()?.habitat_instance_id ?? "",
          role: "hub",
        });
        ws.send(encodeFederationFrame("federation.ping.result", output));
        return;
      }

      if (
        frame.method === "room.federation.append" ||
        frame.method === "room.federation.catch_up" ||
        frame.method === "room.federation.snapshot" ||
        frame.method === "room.federation.create"
      ) {
        if (!isTrustedSession) {
          const { extractRequestId, encodeFederationError } = await import("./satellite-rpc.ts");
          const requestId = extractRequestId(frame.payload);
          if (requestId) {
            ws.send(encodeFederationError(frame.method, requestId, "not trusted"));
          }
          return;
        }
        const { extractRequestId, encodeFederationResult, encodeFederationError } =
          await import("./satellite-rpc.ts");
        const requestId = extractRequestId(frame.payload);
        try {
          const {
            hubHandleRoomAppend,
            hubHandleRoomCatchUp,
            hubHandleRoomSnapshot,
            hubHandleRoomCreate,
          } = await import("@freeanima/features/room/domain/room-federation-handlers.ts");
          let result: unknown;
          if (frame.method === "room.federation.append") {
            result = await hubHandleRoomAppend(frame.payload);
          } else if (frame.method === "room.federation.catch_up") {
            result = await hubHandleRoomCatchUp(frame.payload);
          } else if (frame.method === "room.federation.snapshot") {
            result = await hubHandleRoomSnapshot(frame.payload);
          } else {
            const { habitatCtx } =
              await import("@freeanima/features/habitat/habitat/habitat-api/handlers/runtime.ts");
            const conversation = habitatCtx().conversation;
            result = await hubHandleRoomCreate(
              {
                newConversation: (...args) => conversation.newConversation(...args),
              },
              frame.payload,
            );
          }
          if (requestId) {
            ws.send(encodeFederationResult(frame.method, requestId, result));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "federation room error";
          if (requestId) {
            ws.send(encodeFederationError(frame.method, requestId, msg));
          }
        }
        return;
      }

      closeSession(4400, `unsupported method: ${frame.method}`);
    },
    close() {
      closeSession();
    },
  };
}

export function parseHubAckPayload(payload: unknown) {
  return federationHandshakeAckSchema.safeParse(payload);
}
