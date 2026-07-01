/// <reference lib="dom" />
import type { RpcClient } from "./client.ts";
import { hubHttpFromRpcWsUrl } from "./urls.ts";
import { runHubRpcTransport, type HubRpcTransportHandle } from "./transport.ts";

export type HubRpcConnectionState = "connecting" | "connected" | "disconnected";

export type BundledHubRpcClientOptions = {
  hubRpcWsUrl?: string;
  hubUrl?: string;
  authToken?: string;
  signal?: AbortSignal;
  onConnectionStateChange?: (state: HubRpcConnectionState) => void;
};

export type BundledHubRpcClient = {
  whenReady(): Promise<RpcClient>;
  getClient(): RpcClient | null;
  stop(): void;
  reconnect(): Promise<RpcClient>;
};

const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

let sharedClient: BundledHubRpcClient | null = null;
let sharedTransport: HubRpcTransportHandle | null = null;

import { readSatelliteShell } from "./shell-bridge.ts";

function resolveAuthToken(explicit?: string): string {
  const fromShell = readSatelliteShell()?.remoteAuth?.token?.trim();
  if (explicit?.trim()) return explicit.trim();
  if (fromShell) return fromShell;
  throw new Error("Hub RPC requires auth_token");
}

function resolveHubUrl(options: BundledHubRpcClientOptions): string {
  if (options.hubUrl?.trim()) return options.hubUrl.trim().replace(/\/$/, "");
  if (options.hubRpcWsUrl?.trim()) return hubHttpFromRpcWsUrl(options.hubRpcWsUrl.trim());
  const shell = readSatelliteShell();
  if (shell?.hubUrl?.trim()) return shell.hubUrl.trim().replace(/\/$/, "");
  if (shell?.hubWsUrl?.trim()) return hubHttpFromRpcWsUrl(shell.hubWsUrl.trim());
  return "http://127.0.0.1:2658";
}

function createBundledHubRpcClient(options: BundledHubRpcClientOptions = {}): BundledHubRpcClient {
  let transport: HubRpcTransportHandle | null = null;
  let initPromise: Promise<void> | null = null;

  const notify = (state: HubRpcConnectionState): void => {
    options.onConnectionStateChange?.(state);
  };

  const startTransport = (): HubRpcTransportHandle => {
    transport?.stop();
    notify("connecting");
    const hubUrl = resolveHubUrl(options);
    const authToken = resolveAuthToken(options.authToken);
    transport = runHubRpcTransport({
      hubUrl,
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

  const ensureTransport = async (): Promise<RpcClient> => {
    if (transport?.getClient()) {
      return transport.whenConnected();
    }
    if (!initPromise) {
      initPromise = (async () => {
        startTransport();
        await transport!.whenConnected();
      })();
    }
    await initPromise;
    return transport!.whenConnected();
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
    async reconnect(): Promise<RpcClient> {
      this.stop();
      notify("connecting");
      initPromise = null;
      return ensureTransport();
    },
  };
}

export function getBundledHubRpcClient(
  options: BundledHubRpcClientOptions = {},
): BundledHubRpcClient {
  if (!sharedClient) {
    sharedClient = createBundledHubRpcClient(options);
  }
  return sharedClient;
}

export async function whenHubRpcReady(): Promise<RpcClient> {
  return getBundledHubRpcClient().whenReady();
}

export function resetBundledHubRpcClientForTests(): void {
  sharedClient?.stop();
  sharedClient = null;
  sharedTransport = null;
}

export function subscribeBundledHubRpcConfigChanges(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    void getBundledHubRpcClient()
      .reconnect()
      .catch(() => undefined);
  };
  window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
}
