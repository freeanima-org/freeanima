import { createRpcClient, type RpcClient } from "./client.ts";
import {
  HABITAT_RPC_HEARTBEAT_SEND_CAP_MS,
  HABITAT_RPC_LIVENESS_CHECK_INTERVAL_MS,
  HABITAT_RPC_LIVENESS_SILENCE_MS,
} from "./constants.ts";
import type { HabitatRpcConnectedPayload } from "./lifecycle.ts";
import { serializeHabitatRpcEnvelope } from "./protocol.ts";

export type HabitatRpcReconnectPolicy = {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
};

export type RunHabitatRpcTransportOptions = {
  habitatUrl: string;
  authToken: string;
  reconnect?: HabitatRpcReconnectPolicy | false;
  onConnected: (client: RpcClient, connected: HabitatRpcConnectedPayload) => void | Promise<void>;
  onDisconnected?: () => void;
  createWebSocket?: (wsUrl: string) => WebSocket;
  signal?: AbortSignal;
  /** 测试注入：覆盖默认 liveness 静默阈值 */
  livenessSilenceMs?: number;
  /** 测试注入：覆盖默认 liveness 检查间隔 */
  livenessCheckIntervalMs?: number;
};

export type HabitatRpcTransportHandle = {
  getClient(): RpcClient | null;
  whenConnected(): Promise<RpcClient>;
  getLastInboundAt(): number | null;
  stop(): void;
};

const DEFAULT_POLICY: Required<HabitatRpcReconnectPolicy> = {
  initialMs: 1000,
  maxMs: 30_000,
  factor: 2,
};

function habitatRpcWsUrl(habitatUrl: string): string {
  return habitatUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/rpc/v1";
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

function forceCloseWs(ws: WebSocket): void {
  try {
    ws.close();
  } catch {
    /* ignore */
  }
}

export function runHabitatRpcTransport(
  options: RunHabitatRpcTransportOptions,
): HabitatRpcTransportHandle {
  const policy =
    options.reconnect === false
      ? null
      : {
          initialMs: options.reconnect?.initialMs ?? DEFAULT_POLICY.initialMs,
          maxMs: options.reconnect?.maxMs ?? DEFAULT_POLICY.maxMs,
          factor: options.reconnect?.factor ?? DEFAULT_POLICY.factor,
        };

  const livenessSilenceMs = options.livenessSilenceMs ?? HABITAT_RPC_LIVENESS_SILENCE_MS;
  const livenessCheckIntervalMs =
    options.livenessCheckIntervalMs ?? HABITAT_RPC_LIVENESS_CHECK_INTERVAL_MS;

  let stopped = false;
  let currentClient: RpcClient | null = null;
  let currentWs: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let livenessTimer: ReturnType<typeof setInterval> | null = null;
  let lastInboundAt: number | null = null;
  let heartbeatOff: (() => void) | null = null;
  let connectedWaiters: Array<{
    resolve: (client: RpcClient) => void;
    reject: (error: Error) => void;
  }> = [];
  let connectedPromise: Promise<RpcClient> | null = null;

  function touchInbound(): void {
    lastInboundAt = Date.now();
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    heartbeatOff?.();
    heartbeatOff = null;
  }

  function clearLiveness(): void {
    if (livenessTimer) clearInterval(livenessTimer);
    livenessTimer = null;
  }

  function resetConnectionState(): void {
    clearHeartbeat();
    clearLiveness();
    currentClient = null;
    connectedPromise = null;
    lastInboundAt = null;
  }

  function startLivenessWatch(ws: WebSocket): void {
    clearLiveness();
    livenessTimer = setInterval(() => {
      if (lastInboundAt == null) return;
      if (Date.now() - lastInboundAt > livenessSilenceMs) {
        forceCloseWs(ws);
      }
    }, livenessCheckIntervalMs);
  }

  function startHeartbeat(
    ws: WebSocket,
    rpc: RpcClient,
    connected: HabitatRpcConnectedPayload,
  ): void {
    clearHeartbeat();
    const serverIntervalMs = (connected.heartbeat_interval_sec ?? 30) * 1000;
    const sendIntervalMs = Math.min(serverIntervalMs, HABITAT_RPC_HEARTBEAT_SEND_CAP_MS);

    heartbeatOff = rpc.onEvent("heartbeat", () => {
      touchInbound();
    });

    heartbeatTimer = setInterval(() => {
      try {
        ws.send(
          serializeHabitatRpcEnvelope({
            kind: "evt",
            method: "heartbeat",
            payload: { ts: Date.now() },
          }),
        );
      } catch {
        forceCloseWs(ws);
      }
    }, sendIntervalMs);
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
    const wsUrl = habitatRpcWsUrl(options.habitatUrl);
    const ws = options.createWebSocket?.(wsUrl) ?? new WebSocket(wsUrl);
    currentWs = ws;

    let disconnectNotified = false;
    const notifyDisconnect = (): void => {
      if (disconnectNotified) return;
      disconnectNotified = true;
      currentClient = null;
      connectedPromise = null;
      options.onDisconnected?.();
    };

    ws.addEventListener("message", () => {
      touchInbound();
    });

    try {
      await waitWebSocketOpen(ws);
      touchInbound();

      const rpc = createRpcClient({
        ws,
        onDisconnected: notifyDisconnect,
      });

      const connected = await rpc.connect({ auth_token: options.authToken });
      touchInbound();
      resolveConnected(rpc);
      startHeartbeat(ws, rpc, connected);
      startLivenessWatch(ws);
      await options.onConnected(rpc, connected);
      await waitWebSocketClose(ws);
      resetConnectionState();
      notifyDisconnect();
      currentWs = null;
    } catch (e) {
      resetConnectionState();
      notifyDisconnect();
      forceCloseWs(ws);
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
    getLastInboundAt(): number | null {
      return lastInboundAt;
    },
    stop(): void {
      stopped = true;
      resetConnectionState();
      try {
        currentWs?.close();
      } catch {
        /* ignore */
      }
      currentWs = null;
      rejectConnected(new Error("Habitat RPC transport stopped"));
    },
  };
}
