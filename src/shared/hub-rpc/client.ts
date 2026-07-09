import { randomUuid } from "@freeanima/kernel/random-uuid.ts";

import { HUB_RPC_CONNECT_TIMEOUT_MS, HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS } from "./constants.ts";
import { HubRpcTimeoutError } from "./errors.ts";
import type { HubRpcConnectPayload, HubRpcConnectedPayload } from "./lifecycle.ts";
import { hubRpcConnectPayloadSchema } from "./lifecycle.ts";
import type { HubRpcEnvelope } from "./protocol.ts";
import { parseHubRpcEnvelope, serializeHubRpcEnvelope } from "./protocol.ts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

export type RpcRequestOptions = {
  /** 省略时使用 {@link HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS}；传 0 禁用超时 */
  timeoutMs?: number;
};

export type RpcRequestHandler = (payload: unknown) => unknown | Promise<unknown>;

export type RpcClient = {
  connect(payload: Omit<HubRpcConnectPayload, "protocol">): Promise<HubRpcConnectedPayload>;
  request<T = unknown>(method: string, payload?: unknown, opts?: RpcRequestOptions): Promise<T>;
  onEvent(method: string, handler: (payload: unknown) => void): () => void;
  onRequest(method: string, handler: RpcRequestHandler): () => void;
  close(): void;
};

export type CreateRpcClientOptions = {
  ws: WebSocket;
  onConnected?: (payload: HubRpcConnectedPayload) => void;
  onDisconnected?: () => void;
  /** 全局 Hub→Client 请求处理器（与 {@link RpcClient.onRequest} 二选一或并存） */
  onRequest?: (req: { id: string; method: string; payload: unknown }) => unknown | Promise<unknown>;
};

function resolveRequestTimeoutMs(opts?: RpcRequestOptions): number | null {
  if (opts?.timeoutMs === 0) return null;
  return opts?.timeoutMs ?? HUB_RPC_DEFAULT_REQUEST_TIMEOUT_MS;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new HubRpcTimeoutError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

export function createRpcClient(options: CreateRpcClientOptions): RpcClient {
  const { ws } = options;
  const pending = new Map<string, PendingRequest>();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  const requestHandlers = new Map<string, Set<RpcRequestHandler>>();

  const send = (envelope: HubRpcEnvelope): void => {
    ws.send(serializeHubRpcEnvelope(envelope));
  };

  const dispatchEnvelope = (envelope: HubRpcEnvelope): void => {
    if (envelope.kind === "req") {
      const onRequest = options.onRequest;
      if (onRequest) {
        void (async () => {
          try {
            const payload = await onRequest({
              id: envelope.id,
              method: envelope.method,
              payload: envelope.payload,
            });
            send({ kind: "res", id: envelope.id, ok: true, payload: payload ?? {} });
          } catch (e) {
            send({
              kind: "res",
              id: envelope.id,
              ok: false,
              error: {
                code: "hub_rpc_error",
                message: e instanceof Error ? e.message : String(e),
              },
            });
          }
        })();
        return;
      }
      const handlers = requestHandlers.get(envelope.method);
      if (!handlers?.size) return;
      void (async () => {
        try {
          let result: unknown;
          for (const handler of handlers) {
            result = await handler(envelope.payload);
          }
          send({ kind: "res", id: envelope.id, ok: true, payload: result ?? {} });
        } catch (e) {
          send({
            kind: "res",
            id: envelope.id,
            ok: false,
            error: {
              code: "hub_rpc_error",
              message: e instanceof Error ? e.message : String(e),
            },
          });
        }
      })();
      return;
    }
    if (envelope.kind === "res") {
      const entry = pending.get(envelope.id);
      if (!entry) return;
      pending.delete(envelope.id);
      if (entry.timer) clearTimeout(entry.timer);
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
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(new Error("Hub RPC WebSocket closed"));
    }
    pending.clear();
  });

  return {
    async connect(
      payload: Omit<HubRpcConnectPayload, "protocol">,
    ): Promise<HubRpcConnectedPayload> {
      const body = hubRpcConnectPayloadSchema.parse({ ...payload, protocol: "HubRPC/1.0" });
      const connectPromise = new Promise<HubRpcConnectedPayload>((resolve, reject) => {
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

      return withTimeout(
        connectPromise,
        HUB_RPC_CONNECT_TIMEOUT_MS,
        "Hub RPC connect",
        () => undefined,
      );
    },

    request<T = unknown>(method: string, payload?: unknown, opts?: RpcRequestOptions): Promise<T> {
      const timeoutMs = resolveRequestTimeoutMs(opts);
      const id = randomUuid();
      const requestPromise = new Promise<T>((resolve, reject) => {
        const entry: PendingRequest = {
          resolve: resolve as (value: unknown) => void,
          reject,
          timer: null,
        };
        if (timeoutMs != null) {
          entry.timer = setTimeout(() => {
            pending.delete(id);
            reject(
              new HubRpcTimeoutError(`Hub RPC request ${method} timed out after ${timeoutMs}ms`),
            );
          }, timeoutMs);
        }
        pending.set(id, entry);
        send({ kind: "req", id, method, payload: payload ?? {} });
      });
      return requestPromise;
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

    onRequest(method: string, handler: RpcRequestHandler): () => void {
      let set = requestHandlers.get(method);
      if (!set) {
        set = new Set();
        requestHandlers.set(method, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set?.size === 0) requestHandlers.delete(method);
      };
    },

    close(): void {
      ws.close();
    },
  };
}
