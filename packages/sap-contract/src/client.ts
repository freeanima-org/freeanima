import { randomUuid } from "@freeanima/kernel/random-uuid";
import type { SapEnvelope } from "./protocol.ts";
import { parseSapEnvelope, serializeSapEnvelope } from "./protocol.ts";
import type { ConnectPayload, ConnectedPayload } from "./frames/lifecycle.ts";
import { connectPayloadSchema } from "./frames/lifecycle.ts";
import { SAP_VERSION } from "./protocol.ts";
import type { SapClient, SapMethod, SapRouterInputs, SapRouterOutputs } from "./router.ts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type CreateSapClientOptions = {
  ws: WebSocket;
  onConnected?: (payload: ConnectedPayload) => void;
  onDisconnected?: () => void;
};

export function createSapClient(options: CreateSapClientOptions): SapClient {
  const { ws } = options;
  const pending = new Map<string, PendingRequest>();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();

  const dispatchEnvelope = (envelope: SapEnvelope): void => {
    if (envelope.kind === "res") {
      const entry = pending.get(envelope.id);
      if (!entry) return;
      pending.delete(envelope.id);
      if (envelope.ok) {
        entry.resolve(envelope.payload);
      } else {
        entry.reject(new Error(envelope.error.message));
      }
      return;
    }
    if (envelope.kind === "connected") {
      options.onConnected?.(envelope.payload as ConnectedPayload);
      return;
    }
    if (envelope.kind === "evt") {
      const handlers = eventHandlers.get(envelope.method);
      if (!handlers) return;
      for (const handler of handlers) {
        handler(envelope.payload);
      }
    }
  };

  ws.addEventListener("message", (ev) => {
    if (typeof ev.data !== "string") return;
    try {
      dispatchEnvelope(parseSapEnvelope(ev.data));
    } catch {
      // ignore malformed frames in client
    }
  });

  ws.addEventListener("close", () => {
    options.onDisconnected?.();
    for (const [, entry] of pending) {
      entry.reject(new Error("SAP WebSocket closed"));
    }
    pending.clear();
  });

  function send(envelope: SapEnvelope): void {
    ws.send(serializeSapEnvelope(envelope));
  }

  return {
    async connect(payload: Omit<ConnectPayload, "protocol">): Promise<ConnectedPayload> {
      const body = connectPayloadSchema.parse({ ...payload, protocol: SAP_VERSION });
      return new Promise<ConnectedPayload>((resolve, reject) => {
        const cleanup = (): void => {
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
        };
        const onMessage = (ev: MessageEvent): void => {
          if (typeof ev.data !== "string") return;
          try {
            const envelope = parseSapEnvelope(ev.data);
            if (envelope.kind === "connected") {
              cleanup();
              const connected = envelope.payload as ConnectedPayload;
              options.onConnected?.(connected);
              resolve(connected);
            }
          } catch (e) {
            cleanup();
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        };
        const onClose = (ev: CloseEvent): void => {
          cleanup();
          const reason = ev.reason?.trim();
          reject(new Error(reason || "SAP WebSocket closed during connect"));
        };
        ws.addEventListener("message", onMessage);
        ws.addEventListener("close", onClose, { once: true });
        send({ kind: "connect", payload: body });
      });
    },

    request<K extends SapMethod>(
      method: K,
      payload: SapRouterInputs[K],
    ): Promise<SapRouterOutputs[K]> {
      const id = randomUuid();
      return new Promise<SapRouterOutputs[K]>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        send({ kind: "req", id, method, payload });
      });
    },

    onEvent(method: string, handler: (payload: unknown) => void): () => void {
      let set = eventHandlers.get(method);
      if (!set) {
        set = new Set();
        eventHandlers.set(method, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
      };
    },

    close(): void {
      ws.close();
    },
  };
}
