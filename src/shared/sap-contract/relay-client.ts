/// <reference lib="dom" />
import { randomUuid } from "@freeanima/kernel/random-uuid.ts";
import { parseSapEnvelope, serializeSapEnvelope, type SapEnvelope } from "./protocol.ts";
import type { SapClient, SapMethod, SapRouterInputs, SapRouterOutputs } from "./router.ts";

/** Satellite local relay signals readiness; browser/process clients must wait before req. */
export const SAP_RELAY_READY_METHOD = "relay.ready";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type CreateSapRelayClientOptions = {
  ws: WebSocket;
  onReady?: () => void;
  onDisconnected?: () => void;
};

export type SapRelayClient = SapClient & {
  whenReady(): Promise<void>;
};

function relayWsUrlFromOrigin(origin?: string, path = "/sap/relay/v1"): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:4173");
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function resolveSapRelayWsUrl(origin?: string, path = "/sap/relay/v1"): string {
  return relayWsUrlFromOrigin(origin, path);
}

export function createSapRelayClient(options: CreateSapRelayClientOptions): SapRelayClient {
  const { ws } = options;
  const pending = new Map<string, PendingRequest>();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  let ready = false;
  let readyWaiters: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

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
    if (envelope.kind === "evt") {
      if (envelope.method === SAP_RELAY_READY_METHOD) {
        ready = true;
        options.onReady?.();
        for (const waiter of readyWaiters) waiter.resolve();
        readyWaiters = [];
        return;
      }
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
      /* ignore malformed relay frames */
    }
  });

  ws.addEventListener("close", () => {
    ready = false;
    options.onDisconnected?.();
    for (const [, entry] of pending) {
      entry.reject(new Error("SAP relay WebSocket closed"));
    }
    pending.clear();
    for (const waiter of readyWaiters) {
      waiter.reject(new Error("SAP relay WebSocket closed"));
    }
    readyWaiters = [];
  });

  function send(envelope: SapEnvelope): void {
    ws.send(serializeSapEnvelope(envelope));
  }

  function whenReady(): Promise<void> {
    if (ready) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      readyWaiters.push({ resolve, reject });
    });
  }

  function request<K extends SapMethod>(
    method: K,
    payload: SapRouterInputs[K],
  ): Promise<SapRouterOutputs[K]> {
    const id = randomUuid();
    return new Promise<SapRouterOutputs[K]>((resolve, reject) => {
      void whenReady()
        .then(() => {
          pending.set(id, {
            resolve: resolve as (value: unknown) => void,
            reject,
          });
          send({ kind: "req", id, method, payload });
        })
        .catch(reject);
    });
  }

  function onEvent(method: string, handler: (payload: unknown) => void): () => void {
    let set = eventHandlers.get(method);
    if (!set) {
      set = new Set();
      eventHandlers.set(method, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  function close(): void {
    ws.close();
  }

  return { whenReady, request, onEvent, close };
}
