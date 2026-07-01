import { createRpcClient, type RpcClient } from "./client.ts";
import type { HubRpcConnectedPayload } from "./lifecycle.ts";
import { serializeHubRpcEnvelope } from "./protocol.ts";

export type HubRpcReconnectPolicy = {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
};

export type RunHubRpcTransportOptions = {
  hubUrl: string;
  authToken: string;
  reconnect?: HubRpcReconnectPolicy | false;
  onConnected: (client: RpcClient, connected: HubRpcConnectedPayload) => void | Promise<void>;
  onDisconnected?: () => void;
  createWebSocket?: (wsUrl: string) => WebSocket;
  signal?: AbortSignal;
};

export type HubRpcTransportHandle = {
  getClient(): RpcClient | null;
  whenConnected(): Promise<RpcClient>;
  stop(): void;
};

const DEFAULT_POLICY: Required<HubRpcReconnectPolicy> = {
  initialMs: 1000,
  maxMs: 30_000,
  factor: 2,
};

function hubRpcWsUrl(hubUrl: string): string {
  return hubUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/hub/rpc/v1";
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

function waitWebSocketClose(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ws.addEventListener("close", () => resolve(), { once: true });
  });
}

export function runHubRpcTransport(options: RunHubRpcTransportOptions): HubRpcTransportHandle {
  const policy =
    options.reconnect === false
      ? null
      : {
          initialMs: options.reconnect?.initialMs ?? DEFAULT_POLICY.initialMs,
          maxMs: options.reconnect?.maxMs ?? DEFAULT_POLICY.maxMs,
          factor: options.reconnect?.factor ?? DEFAULT_POLICY.factor,
        };

  let stopped = false;
  let currentClient: RpcClient | null = null;
  let currentWs: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let connectedWaiters: Array<{
    resolve: (client: RpcClient) => void;
    reject: (error: Error) => void;
  }> = [];
  let connectedPromise: Promise<RpcClient> | null = null;

  function clearHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function startHeartbeat(ws: WebSocket, connected: HubRpcConnectedPayload): void {
    clearHeartbeat();
    const intervalSec = connected.heartbeat_interval_sec ?? 30;
    heartbeatTimer = setInterval(() => {
      try {
        ws.send(
          serializeHubRpcEnvelope({
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

  function resolveConnected(client: RpcClient): void {
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

  function whenConnected(): Promise<RpcClient> {
    if (currentClient) return Promise.resolve(currentClient);
    if (!connectedPromise) {
      connectedPromise = new Promise<RpcClient>((resolve, reject) => {
        connectedWaiters.push({ resolve, reject });
      });
    }
    return connectedPromise;
  }

  async function connectOnce(): Promise<void> {
    const wsUrl = hubRpcWsUrl(options.hubUrl);
    const ws = options.createWebSocket?.(wsUrl) ?? new WebSocket(wsUrl);
    currentWs = ws;

    let disconnectNotified = false;
    const notifyDisconnect = (): void => {
      if (disconnectNotified) return;
      disconnectNotified = true;
      options.onDisconnected?.();
    };

    try {
      await waitWebSocketOpen(ws);

      const rpc = createRpcClient({
        ws,
        onDisconnected: notifyDisconnect,
      });

      const connected = await rpc.connect({ auth_token: options.authToken });
      resolveConnected(rpc);
      startHeartbeat(ws, connected);
      await options.onConnected(rpc, connected);
      await waitWebSocketClose(ws);
      clearHeartbeat();
      currentClient = null;
      notifyDisconnect();
      currentWs = null;
    } catch (e) {
      clearHeartbeat();
      currentClient = null;
      notifyDisconnect();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      currentWs = null;
      throw e;
    }
  }

  async function runLoop(): Promise<void> {
    let delay = policy?.initialMs ?? DEFAULT_POLICY.initialMs;
    while (true) {
      if (stopped || options.signal?.aborted) break;
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
    getClient(): RpcClient | null {
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
      rejectConnected(new Error("Hub RPC transport stopped"));
    },
  };
}
