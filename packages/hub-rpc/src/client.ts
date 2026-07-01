import { randomUuid } from "@freeanima/kernel/random-uuid";

import type { HubRpcConnectPayload, HubRpcConnectedPayload } from "./lifecycle.ts";
import { hubRpcConnectPayloadSchema } from "./lifecycle.ts";
import type { HubRpcEnvelope } from "./protocol.ts";
import { parseHubRpcEnvelope, serializeHubRpcEnvelope } from "./protocol.ts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type RpcClient = {
  connect(payload: Omit<HubRpcConnectPayload, "protocol">): Promise<HubRpcConnectedPayload>;
  request<T = unknown>(method: string, payload?: unknown): Promise<T>;
  onEvent(method: string, handler: (payload: unknown) => void): () => void;
  close(): void;
};

export type CreateRpcClientOptions = {
  ws: WebSocket;
  onConnected?: (payload: HubRpcConnectedPayload) => void;
  onDisconnected?: () => void;
};

export function createRpcClient(options: CreateRpcClientOptions): RpcClient {
  const { ws } = options;
  const pending = new Map<string, PendingRequest>();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();

  const dispatchEnvelope = (envelope: HubRpcEnvelope): void => {
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
      options.onConnected?.(envelope.payload as HubRpcConnectedPayload);
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
      dispatchEnvelope(parseHubRpcEnvelope(ev.data));
    } catch {
      // ignore malformed frames in client
    }
  });

  ws.addEventListener("close", () => {
    options.onDisconnected?.();
    for (const [, entry] of pending) {
      entry.reject(new Error("Hub RPC WebSocket closed"));
    }
    pending.clear();
  });

  function send(envelope: HubRpcEnvelope): void {
    ws.send(serializeHubRpcEnvelope(envelope));
  }

  return {
    async connect(
      payload: Omit<HubRpcConnectPayload, "protocol">,
    ): Promise<HubRpcConnectedPayload> {
      const body = hubRpcConnectPayloadSchema.parse({ ...payload, protocol: "HubRPC/1.0" });
      return new Promise<HubRpcConnectedPayload>((resolve, reject) => {
        const cleanup = (): void => {
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("close", onClose);
        };
        const onMessage = (ev: MessageEvent): void => {
          if (typeof ev.data !== "string") return;
          try {
            const envelope = parseHubRpcEnvelope(ev.data);
            if (envelope.kind === "connected") {
              cleanup();
              const connected = envelope.payload as HubRpcConnectedPayload;
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
          reject(new Error(reason || "Hub RPC WebSocket closed during connect"));
        };
        ws.addEventListener("message", onMessage);
        ws.addEventListener("close", onClose, { once: true });
        send({ kind: "connect", payload: body });
      });
    },

    request<T = unknown>(method: string, payload?: unknown): Promise<T> {
      const id = randomUuid();
      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        send({ kind: "req", id, method, payload: payload ?? {} });
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
