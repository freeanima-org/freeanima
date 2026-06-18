import { createSapClient } from "./client.ts";
import type { ConnectPayload, ConnectedPayload } from "./frames/lifecycle.ts";
import { serializeSapEnvelope } from "./protocol.ts";
import type { SapClient } from "./router.ts";
import { loadSapInstanceId, type SapInstanceStore } from "./instance-store.ts";

export type SapReconnectPolicy = {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
};

export type RunSapTransportOptions = {
  hubUrl: string;
  connect: Omit<ConnectPayload, "protocol">;
  instanceStore?: SapInstanceStore;
  reconnect?: SapReconnectPolicy | false;
  onConnected: (client: SapClient, connected: ConnectedPayload) => void | Promise<void>;
  onDisconnected?: () => void;
  createWebSocket?: (wsUrl: string) => WebSocket;
  signal?: AbortSignal;
};

export type SapTransportHandle = {
  getClient(): SapClient | null;
  whenConnected(): Promise<SapClient>;
  stop(): void;
};

const DEFAULT_POLICY: Required<SapReconnectPolicy> = {
  initialMs: 1000,
  maxMs: 30_000,
  factor: 2,
};

function hubWsUrl(hubUrl: string): string {
  return hubUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/sap/v1";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function waitWebSocketOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("WebSocket open failed")), {
      once: true,
    });
  });
}

export function runSapTransport(options: RunSapTransportOptions): SapTransportHandle {
  const policy =
    options.reconnect === false
      ? null
      : {
          initialMs: options.reconnect?.initialMs ?? DEFAULT_POLICY.initialMs,
          maxMs: options.reconnect?.maxMs ?? DEFAULT_POLICY.maxMs,
          factor: options.reconnect?.factor ?? DEFAULT_POLICY.factor,
        };

  let stopped = false;
  let currentClient: SapClient | null = null;
  let currentWs: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let connectedWaiters: Array<{
    resolve: (client: SapClient) => void;
    reject: (error: Error) => void;
  }> = [];
  let connectedPromise: Promise<SapClient> | null = null;

  function clearHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function startHeartbeat(ws: WebSocket, connected: ConnectedPayload): void {
    clearHeartbeat();
    const intervalSec = connected.heartbeat_interval_sec ?? 30;
    heartbeatTimer = setInterval(() => {
      try {
        ws.send(
          serializeSapEnvelope({
            kind: "evt",
            method: "heartbeat",
            payload: { ts: Date.now() },
          }),
        );
      } catch {
        /* ws may be closing */
      }
    }, intervalSec * 1000);
  }

  function resolveConnected(client: SapClient): void {
    currentClient = client;
    for (const waiter of connectedWaiters) {
      waiter.resolve(client);
    }
    connectedWaiters = [];
  }

  function rejectConnected(error: Error): void {
    for (const waiter of connectedWaiters) {
      waiter.reject(error);
    }
    connectedWaiters = [];
    connectedPromise = null;
  }

  function whenConnected(): Promise<SapClient> {
    if (currentClient) return Promise.resolve(currentClient);
    if (!connectedPromise) {
      connectedPromise = new Promise<SapClient>((resolve, reject) => {
        connectedWaiters.push({ resolve, reject });
      });
    }
    return connectedPromise;
  }

  function waitForDisconnect(ws: WebSocket): Promise<void> {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      ws.addEventListener("close", () => resolve(), { once: true });
    });
  }

  async function connectOnce(): Promise<void> {
    const wsUrl = hubWsUrl(options.hubUrl);
    const ws = options.createWebSocket?.(wsUrl) ?? new WebSocket(wsUrl);
    currentWs = ws;
    await waitWebSocketOpen(ws);

    let disconnectNotified = false;
    const notifyDisconnect = (): void => {
      if (disconnectNotified) return;
      disconnectNotified = true;
      options.onDisconnected?.();
    };

    const sap = createSapClient({
      ws,
      onDisconnected: notifyDisconnect,
    });

    const connectBody: Omit<ConnectPayload, "protocol"> = { ...options.connect };
    const storedId = await loadSapInstanceId(options.instanceStore);
    if (storedId && !connectBody.instance_id) {
      connectBody.instance_id = storedId;
    }

    const connected = await sap.connect(connectBody);
    options.instanceStore?.save(connected.instance_id);
    resolveConnected(sap);
    startHeartbeat(ws, connected);
    await options.onConnected(sap, connected);
    await waitForDisconnect(ws);
    clearHeartbeat();
    currentClient = null;
    notifyDisconnect();
    currentWs = null;
  }

  async function runLoop(): Promise<void> {
    let delay = policy?.initialMs ?? DEFAULT_POLICY.initialMs;
    while (!stopped && !options.signal?.aborted) {
      try {
        await connectOnce();
        if (!policy) return;
        delay = policy.initialMs;
      } catch (e) {
        if (stopped || options.signal?.aborted) return;
        if (!policy) {
          rejectConnected(e instanceof Error ? e : new Error(String(e)));
          return;
        }
        try {
          await sleep(delay, options.signal);
        } catch {
          return;
        }
        delay = Math.min(delay * policy.factor, policy.maxMs);
      }
    }
  }

  void runLoop().catch((e) => {
    if (!stopped) rejectConnected(e instanceof Error ? e : new Error(String(e)));
  });

  return {
    getClient(): SapClient | null {
      return currentClient;
    },
    whenConnected,
    stop(): void {
      stopped = true;
      clearHeartbeat();
      currentClient = null;
      try {
        currentWs?.close();
      } catch {
        /* ignore */
      }
      currentWs = null;
      rejectConnected(new Error("SAP transport stopped"));
    },
  };
}
