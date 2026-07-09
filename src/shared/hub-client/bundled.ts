/// <reference lib="dom" />
import { getBundledHubRpcClient, type RpcClient } from "@freeanima/shared/hub-rpc";

import { createFullHubClient, hubHttpFromWsUrl, type HubClient } from "./index.ts";

type SatelliteShell = {
  remoteAuth?: { token?: string };
  hubWsUrl?: string;
  hubUrl?: string;
};

function satelliteShell(): SatelliteShell | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { satelliteShell?: SatelliteShell }).satelliteShell;
}

export type BundledHubClientOptions = {
  hubRpcWsUrl?: string;
  hubUrl?: string;
  authToken?: string;
  profile?: "console" | "satellite";
  fetch?: typeof fetch;
};

let sharedHubClient: HubClient | null = null;
let sharedKey = "";

function resolveAuthToken(explicit?: string): string | undefined {
  const shell = satelliteShell();
  return explicit?.trim() || shell?.remoteAuth?.token?.trim() || undefined;
}

function resolveHubRpcWsUrl(options: BundledHubClientOptions): string {
  if (options.hubRpcWsUrl?.trim()) return options.hubRpcWsUrl.trim();
  const shell = satelliteShell();
  if (shell?.hubWsUrl?.trim()) return shell.hubWsUrl.trim();
  const http = options.hubUrl?.trim() || shell?.hubUrl?.trim() || "http://127.0.0.1:2658";
  return `${http.replace(/\/$/, "").replace(/^http/i, "ws")}/hub/rpc/v1`;
}

export function getBundledHubClient(options: BundledHubClientOptions = {}): HubClient {
  const wsUrl = resolveHubRpcWsUrl(options);
  const httpOrigin = hubHttpFromWsUrl(wsUrl);
  const token = resolveAuthToken(options.authToken);
  const profile = options.profile ?? "satellite";
  const key = `${wsUrl}\0${token ?? ""}\0${profile}\0${options.fetch ? "1" : "0"}`;
  if (sharedHubClient && sharedKey === key) return sharedHubClient;

  const hubRpc = getBundledHubRpcClient({
    hubRpcWsUrl: wsUrl,
    ...(token !== undefined ? { authToken: token } : {}),
  });

  sharedHubClient = createFullHubClient({
    httpOrigin,
    ...(token !== undefined ? { authToken: token } : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    profile,
    getRpcClient: (): Promise<RpcClient> => hubRpc.whenReady(),
  });
  sharedKey = key;
  return sharedHubClient;
}

export function resetBundledHubClientForTests(): void {
  sharedHubClient = null;
  sharedKey = "";
}
