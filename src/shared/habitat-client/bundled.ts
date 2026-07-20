/// <reference lib="dom" />
import { getBundledHabitatRpcClient, type RpcClient } from "@freeanima/shared/habitat-rpc";

import { createFullHabitatClient, habitatHttpFromWsUrl, type HabitatClient } from "./index.ts";

type SatelliteShell = {
  remoteAuth?: { token?: string };
  habitatWsUrl?: string;
  habitatUrl?: string;
};

function satelliteShell(): SatelliteShell | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { satelliteShell?: SatelliteShell }).satelliteShell;
}

export type BundledHabitatClientOptions = {
  hubRpcWsUrl?: string;
  habitatUrl?: string;
  authToken?: string;
  profile?: "habitat" | "satellite";
  fetch?: typeof fetch;
};

let sharedHabitatClient: HabitatClient | null = null;
let sharedKey = "";

function resolveAuthToken(explicit?: string): string | undefined {
  const shell = satelliteShell();
  return explicit?.trim() || shell?.remoteAuth?.token?.trim() || undefined;
}

function resolveHabitatRpcWsUrl(options: BundledHabitatClientOptions): string {
  if (options.hubRpcWsUrl?.trim()) return options.hubRpcWsUrl.trim();
  const shell = satelliteShell();
  if (shell?.habitatWsUrl?.trim()) return shell.habitatWsUrl.trim();
  const http = options.habitatUrl?.trim() || shell?.habitatUrl?.trim() || "http://127.0.0.1:2658";
  return `${http.replace(/\/$/, "").replace(/^http/i, "ws")}/rpc/v1`;
}

export function resolveBundledHabitatClientOptions(
  options: BundledHabitatClientOptions = {},
): Parameters<typeof createFullHabitatClient>[0] {
  const wsUrl = resolveHabitatRpcWsUrl(options);
  const httpOrigin = habitatHttpFromWsUrl(wsUrl);
  const token = resolveAuthToken(options.authToken);
  const profile = options.profile ?? "satellite";
  const hubRpc = getBundledHabitatRpcClient({
    hubRpcWsUrl: wsUrl,
    ...(token !== undefined ? { authToken: token } : {}),
  });
  return {
    httpOrigin,
    ...(token !== undefined ? { authToken: token } : {}),
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    profile,
    getRpcClient: (): Promise<RpcClient> => hubRpc.whenReady(),
  };
}

export function getSatelliteHabitatClient(): HabitatClient {
  return getBundledHabitatClient({ profile: "satellite" });
}

export function getBundledHabitatClient(options: BundledHabitatClientOptions = {}): HabitatClient {
  const wsUrl = resolveHabitatRpcWsUrl(options);
  const token = resolveAuthToken(options.authToken);
  const profile = options.profile ?? "satellite";
  const key = `${wsUrl}\0${token ?? ""}\0${profile}\0${options.fetch ? "1" : "0"}`;
  if (sharedHabitatClient && sharedKey === key) return sharedHabitatClient;

  sharedHabitatClient = createFullHabitatClient(resolveBundledHabitatClientOptions(options));
  sharedKey = key;
  return sharedHabitatClient;
}

export function resetBundledHabitatClientForTests(): void {
  sharedHabitatClient = null;
  sharedKey = "";
}
