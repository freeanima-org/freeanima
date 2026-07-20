/// <reference lib="dom" />
import type { RpcClient } from "./client.ts";
import { HABITAT_RPC_LIVENESS_SILENCE_MS } from "./constants.ts";
import { habitatHttpFromRpcWsUrl } from "./urls.ts";
import { runHubRpcTransport, type HubRpcTransportHandle } from "./transport.ts";

export type HabitatRpcConnectionState = "connecting" | "connected" | "disconnected";

export type BundledHubRpcClientOptions = {
  hubRpcWsUrl?: string;
  habitatUrl?: string;
  authToken?: string;
  signal?: AbortSignal;
  onConnectionStateChange?: (state: HabitatRpcConnectionState) => void;
};

export type ReconnectOptions = {
  /** true 时强制断开重建（如 Habitat 配置变更）；默认健康连接直接复用。 */
  force?: boolean;
};

export type BundledHubRpcClient = {
  whenReady(): Promise<RpcClient>;
  getClient(): RpcClient | null;
  stop(): void;
  reconnect(opts?: ReconnectOptions): Promise<RpcClient>;
};

const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

let sharedClient: BundledHubRpcClient | null = null;
let sharedTransport: HubRpcTransportHandle | null = null;
let cachedConnectionState: HabitatRpcConnectionState = "connecting";
const connectionStateListeners = new Set<(state: HabitatRpcConnectionState) => void>();
let foregroundWatchInstalled = false;

import { readSatelliteShell } from "./shell-bridge.ts";

function broadcastConnectionState(state: HabitatRpcConnectionState): void {
  cachedConnectionState = state;
  for (const listener of connectionStateListeners) {
    listener(state);
  }
}

export function getHabitatRpcConnectionState(): HabitatRpcConnectionState {
  return cachedConnectionState;
}

export function getHubRpcLastInboundAt(): number | null {
  return sharedTransport?.getLastInboundAt() ?? null;
}

function ensureHubForegroundReconnectWatch(): void {
  if (foregroundWatchInstalled || typeof document === "undefined") return;
  foregroundWatchInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (cachedConnectionState !== "connected") return;
    const lastInbound = sharedTransport?.getLastInboundAt();
    if (lastInbound == null) return;
    if (Date.now() - lastInbound <= HABITAT_RPC_LIVENESS_SILENCE_MS) return;
    void getBundledHabitatRpcClient()
      .reconnect()
      .catch(() => undefined);
  });
}

export function subscribeHabitatRpcConnectionState(
  listener: (state: HabitatRpcConnectionState) => void,
): () => void {
  ensureHubForegroundReconnectWatch();
  connectionStateListeners.add(listener);
  listener(cachedConnectionState);
  if (!sharedClient && typeof window !== "undefined" && hasBundledHubRpcAuthToken()) {
    try {
      void getBundledHabitatRpcClient()
        .whenReady()
        .catch(() => undefined);
    } catch {
      // 缺少 auth_token 等配置时保持当前状态
    }
  }
  return () => {
    connectionStateListeners.delete(listener);
  };
}

export async function reconnectHabitatRpc(opts?: ReconnectOptions): Promise<RpcClient> {
  return getBundledHabitatRpcClient().reconnect(opts);
}

function resolveAuthToken(explicit?: string): string {
  const fromShell = readSatelliteShell()?.remoteAuth?.token?.trim();
  if (explicit?.trim()) return explicit.trim();
  if (fromShell) return fromShell;
  throw new Error("Habitat RPC requires auth_token");
}

function hasBundledHubRpcAuthToken(options: BundledHubRpcClientOptions = {}): boolean {
  try {
    resolveAuthToken(options.authToken);
    return true;
  } catch {
    return false;
  }
}

function resolveHubUrl(options: BundledHubRpcClientOptions): string {
  if (options.habitatUrl?.trim()) return options.habitatUrl.trim().replace(/\/$/, "");
  if (options.hubRpcWsUrl?.trim()) return habitatHttpFromRpcWsUrl(options.hubRpcWsUrl.trim());
  const shell = readSatelliteShell();
  if (shell?.habitatUrl?.trim()) return shell.habitatUrl.trim().replace(/\/$/, "");
  if (shell?.habitatWsUrl?.trim()) return habitatHttpFromRpcWsUrl(shell.habitatWsUrl.trim());
  return "http://127.0.0.1:2658";
}

function createBundledHubRpcClient(options: BundledHubRpcClientOptions = {}): BundledHubRpcClient {
  let transport: HubRpcTransportHandle | null = null;
  let initPromise: Promise<void> | null = null;

  const notify = (state: HabitatRpcConnectionState): void => {
    options.onConnectionStateChange?.(state);
    broadcastConnectionState(state);
  };

  const startTransport = (): HubRpcTransportHandle => {
    transport?.stop();
    const habitatUrl = resolveHubUrl(options);
    const authToken = resolveAuthToken(options.authToken);
    notify("connecting");
    transport = runHubRpcTransport({
      habitatUrl,
      authToken,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      onConnected: async () => {
        notify("connected");
      },
      onDisconnected: () => {
        notify("disconnected");
      },
    });
    sharedTransport = transport;
    return transport;
  };

  const isConnectionHealthy = (): boolean => {
    const client = transport?.getClient();
    if (!client || cachedConnectionState !== "connected") return false;
    const lastInbound = transport?.getLastInboundAt() ?? null;
    if (lastInbound == null) return false;
    return Date.now() - lastInbound <= HABITAT_RPC_LIVENESS_SILENCE_MS;
  };

  const ensureTransport = async (): Promise<RpcClient> => {
    if (transport?.getClient()) {
      return transport.whenConnected();
    }
    if (!initPromise) {
      initPromise = (async () => {
        try {
          startTransport();
          if (transport === null) {
            throw new Error("hub RPC transport failed to start");
          }
          await transport.whenConnected();
        } catch (err) {
          initPromise = null;
          transport = null;
          if (sharedTransport) sharedTransport = null;
          notify("disconnected");
          throw err;
        }
      })();
    }
    await initPromise;
    if (transport === null) {
      throw new Error("hub RPC transport not initialized");
    }
    return transport.whenConnected();
  };

  return {
    whenReady: ensureTransport,
    getClient(): RpcClient | null {
      return transport?.getClient() ?? null;
    },
    stop(): void {
      const active = transport;
      active?.stop();
      transport = null;
      initPromise = null;
      if (sharedTransport === active) sharedTransport = null;
    },
    async reconnect(opts?: ReconnectOptions): Promise<RpcClient> {
      // 已有健康连接时优先复用，避免无谓断开重连（churn）。
      if (!opts?.force) {
        const client = transport?.getClient();
        if (client && isConnectionHealthy()) return client;
      }
      this.stop();
      notify("connecting");
      initPromise = null;
      return ensureTransport();
    },
  };
}

export function getBundledHabitatRpcClient(
  options: BundledHubRpcClientOptions = {},
): BundledHubRpcClient {
  if (!sharedClient) {
    sharedClient = createBundledHubRpcClient(options);
  }
  return sharedClient;
}

export async function whenHabitatRpcReady(): Promise<RpcClient> {
  return getBundledHabitatRpcClient().whenReady();
}

export function resetBundledHubRpcClientForTests(): void {
  sharedClient?.stop();
  sharedClient = null;
  sharedTransport = null;
  cachedConnectionState = "connecting";
  connectionStateListeners.clear();
}

export function subscribeBundledHubRpcConfigChanges(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    if (!hasBundledHubRpcAuthToken()) return;
    // 配置变更（Habitat URL / token）必须强制重建，不能复用旧连接。
    void getBundledHabitatRpcClient()
      .reconnect({ force: true })
      .catch(() => undefined);
  };
  window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
}
