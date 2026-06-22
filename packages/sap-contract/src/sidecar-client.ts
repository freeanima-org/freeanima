import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { createSapRelayClient, type SapRelayClient } from "./relay-client.ts";
import { createSapSessionStreamClient, type SubscribeCallbacks } from "./session-stream-core.ts";
import type { SapReconnectPolicy } from "./transport.ts";
import { resolveRelayWsUrl } from "./urls.ts";

export type SapConnectionState = "connecting" | "connected" | "disconnected";

export type SapSidecarClientOptions = {
  relayWsUrl?: string;
  configUrl?: string;
  signal?: AbortSignal;
  reconnect?: SapReconnectPolicy | false;
  onConnectionChange?: (state: SapConnectionState) => void;
  createWebSocket?: (url: string) => WebSocket;
};

export type SapSidecarClient = {
  whenReady(): Promise<SapRelayClient>;
  getConnectionState(): SapConnectionState;
  reconnect(): Promise<SapRelayClient>;
  stop(): void;
  subscribeSessionEvents(sessionId: string, onUpdate: () => void): { unsubscribe: () => void };
  sendMessageStream(
    input: { sessionId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
};

const DEFAULT_POLICY: Required<SapReconnectPolicy> = {
  initialMs: 1_000,
  maxMs: 30_000,
  factor: 2,
};

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
    ws.addEventListener("error", () => reject(new Error("SAP relay WebSocket open failed")), {
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

export function createSapSidecarClient(options: SapSidecarClientOptions = {}): SapSidecarClient {
  const policy =
    options.reconnect === false
      ? null
      : {
          initialMs: options.reconnect?.initialMs ?? DEFAULT_POLICY.initialMs,
          maxMs: options.reconnect?.maxMs ?? DEFAULT_POLICY.maxMs,
          factor: options.reconnect?.factor ?? DEFAULT_POLICY.factor,
        };

  let relay: SapRelayClient | null = null;
  let ws: WebSocket | null = null;
  let stopped = false;
  let loopRunning = false;
  let connectionState: SapConnectionState = "disconnected";
  let readyWaiters: Array<{
    resolve: (client: SapRelayClient) => void;
    reject: (error: Error) => void;
  }> = [];

  const setState = (next: SapConnectionState): void => {
    if (connectionState === next) return;
    connectionState = next;
    options.onConnectionChange?.(next);
  };

  const rejectReadyWaiters = (error: Error): void => {
    for (const waiter of readyWaiters) {
      waiter.reject(error);
    }
    readyWaiters = [];
  };

  const resolveReadyWaiters = (client: SapRelayClient): void => {
    for (const waiter of readyWaiters) {
      waiter.resolve(client);
    }
    readyWaiters = [];
  };

  const clearRelay = (): void => {
    relay = null;
    ws = null;
  };

  const resolveRelayUrl = async (): Promise<string> => {
    let relayUrl = options.relayWsUrl;
    if (!relayUrl && options.configUrl) {
      const res = await fetch(options.configUrl);
      const raw = (await res.json()) as { relay_ws_url?: string };
      relayUrl = raw.relay_ws_url?.trim();
    }
    relayUrl ??= resolveRelayWsUrl();
    return relayUrl;
  };

  const connectOnce = async (): Promise<SapRelayClient> => {
    if (stopped || options.signal?.aborted) {
      throw new Error("aborted");
    }

    setState("connecting");
    const relayUrl = await resolveRelayUrl();
    const nextWs = options.createWebSocket?.(relayUrl) ?? new WebSocket(relayUrl);
    ws = nextWs;

    await waitWebSocketOpen(nextWs);
    const nextRelay = createSapRelayClient({
      ws: nextWs,
      onReady: () => {
        /* relay.ready handled inside relay client */
      },
      onDisconnected: () => {
        if (stopped || options.signal?.aborted) return;
        setState("disconnected");
      },
    });
    relay = nextRelay;
    await nextRelay.whenReady();
    setState("connected");
    resolveReadyWaiters(nextRelay);
    return nextRelay;
  };

  const runLoop = async (): Promise<void> => {
    let delay = policy?.initialMs ?? DEFAULT_POLICY.initialMs;
    while (!stopped && !options.signal?.aborted) {
      try {
        await connectOnce();
        await waitWebSocketClose(ws!);
        clearRelay();
        if (stopped || options.signal?.aborted) return;
        setState("disconnected");
        if (!policy) return;
        delay = policy.initialMs;
      } catch (e) {
        clearRelay();
        if (stopped || options.signal?.aborted) return;
        setState("disconnected");
        if (!policy) {
          rejectReadyWaiters(e instanceof Error ? e : new Error(String(e)));
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
  };

  const startLoop = (): void => {
    if (loopRunning || stopped) return;
    loopRunning = true;
    void runLoop().finally(() => {
      loopRunning = false;
    });
  };

  const ensureRelay = async (): Promise<SapClient> => {
    if (relay && ws && ws.readyState === WebSocket.OPEN) {
      await relay.whenReady();
      return relay;
    }
    startLoop();
    return whenReadyInternal();
  };

  const whenReadyInternal = (): Promise<SapRelayClient> => {
    if (relay && ws && ws.readyState === WebSocket.OPEN) {
      return relay.whenReady().then(() => relay!);
    }
    return new Promise<SapRelayClient>((resolve, reject) => {
      readyWaiters.push({ resolve, reject });
    });
  };

  startLoop();

  const stream = createSapSessionStreamClient(() => ensureRelay());

  return {
    whenReady: whenReadyInternal,
    getConnectionState: () => connectionState,
    reconnect: async () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      clearRelay();
      setState("disconnected");
      startLoop();
      return whenReadyInternal();
    },
    stop(): void {
      stopped = true;
      stream.detach();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      clearRelay();
      rejectReadyWaiters(new Error("SAP sidecar client stopped"));
      setState("disconnected");
    },
    subscribeSessionEvents: stream.subscribeSessionEvents.bind(stream),
    sendMessageStream: stream.sendMessageStream.bind(stream),
  };
}

/** @deprecated Use createSapSidecarClient */
export const createSapRelayBrowserClient = createSapSidecarClient;

export type SapRelayBrowserClient = SapSidecarClient;
export type SapRelayBrowserClientOptions = SapSidecarClientOptions;
