/// <reference lib="dom" />
import {
  getBundledHabitatRpcClient,
  type RpcClient,
} from "@freeanima/shared/habitat-rpc/bundled-browser.ts";

import { createFullHabitatClient, habitatHttpFromWsUrl, type HabitatClient } from "./index.ts";
import type { HabitatHttpFetch } from "./client.ts";

type PortalShell = {
  remoteAuth?: { token?: string };
  habitatWsUrl?: string;
  habitatUrl?: string;
  isNativeShell?: boolean;
  isTauri?: boolean;
};

function portalShell(): PortalShell | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { portalShell?: PortalShell }).portalShell;
}

export type BundledHabitatClientOptions = {
  habitatRpcWsUrl?: string;
  habitatUrl?: string;
  authToken?: string;
  profile?: "habitat" | "outpost";
  fetch?: HabitatHttpFetch;
};

let sharedHabitatClient: HabitatClient | null = null;
let sharedKey = "";

function resolveAuthToken(explicit?: string): string | undefined {
  const shell = portalShell();
  return explicit?.trim() || shell?.remoteAuth?.token?.trim() || undefined;
}

function resolveDefaultHttpOrigin(): string {
  if (typeof window !== "undefined") {
    const shell = portalShell();
    const native = Boolean(shell?.isNativeShell || shell?.isTauri);
    if (!native && window.location?.origin) {
      return window.location.origin.replace(/\/$/, "");
    }
  }
  return "http://127.0.0.1:2658";
}

function resolveHabitatRpcWsUrl(options: BundledHabitatClientOptions): string {
  const shell = portalShell();
  // 与 habitat-rpc/bundled-browser 一致：壳配置优先，避免单例闭包旧地址
  if (shell?.habitatWsUrl?.trim()) return shell.habitatWsUrl.trim();
  if (shell?.habitatUrl?.trim()) {
    const http = shell.habitatUrl.trim().replace(/\/$/, "");
    return `${http.replace(/^http/i, "ws")}/rpc/v1`;
  }
  if (options.habitatRpcWsUrl?.trim()) return options.habitatRpcWsUrl.trim();
  const http = options.habitatUrl?.trim() || resolveDefaultHttpOrigin();
  return `${http.replace(/\/$/, "").replace(/^http/i, "ws")}/rpc/v1`;
}

export function resolveBundledHabitatClientOptions(
  options: BundledHabitatClientOptions = {},
): Parameters<typeof createFullHabitatClient>[0] {
  const wsUrl = resolveHabitatRpcWsUrl(options);
  const httpOrigin = habitatHttpFromWsUrl(wsUrl);
  const token = resolveAuthToken(options.authToken);
  const profile = options.profile ?? "outpost";
  const hubRpc = getBundledHabitatRpcClient({
    habitatRpcWsUrl: wsUrl,
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

export function getOutpostHabitatClient(): HabitatClient {
  return getBundledHabitatClient({ profile: "outpost" });
}

export function getBundledHabitatClient(options: BundledHabitatClientOptions = {}): HabitatClient {
  const wsUrl = resolveHabitatRpcWsUrl(options);
  const token = resolveAuthToken(options.authToken);
  const profile = options.profile ?? "outpost";
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
