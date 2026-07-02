/// <reference lib="dom" />
export {
  createBundledSapStreamClient,
  getBundledSapStreamClient,
  whenBundledSapClientReady,
  subscribeShellConfigChanges,
  type BundledSapStreamClient,
  type SapConnectionState,
} from "./bundled-sap-stream.ts";

import {
  getBundledSapStreamClient,
  createBundledSapStreamClient,
  type BundledSapStreamClient,
} from "./bundled-sap-stream.ts";
import { resolveHubRpcWsUrl } from "./urls.ts";
import { formatSapPlatform } from "./naming.ts";

/** @deprecated 使用 getBundledSapStreamClient */
export type SapDirectClient = BundledSapStreamClient;

export type SapDirectClientOptions = Parameters<typeof createBundledSapStreamClient>[0];

export type DirectSatelliteConfig = {
  hub_ws_url: string;
  app_id: string;
  instance_id?: string;
};

export function createSapDirectClient(options: SapDirectClientOptions = {}): SapDirectClient {
  return getBundledSapStreamClient(options);
}

export async function loadDirectSatelliteConfig(
  configUrl = "/config.json",
): Promise<DirectSatelliteConfig> {
  const res = await fetch(configUrl);
  if (!res.ok) {
    throw new Error(`加载 config 失败: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Partial<DirectSatelliteConfig>;
  if (!raw.hub_ws_url?.trim()) {
    throw new Error("config.json 缺少 hub_ws_url");
  }
  const instanceId = raw.instance_id?.trim();
  return {
    hub_ws_url: raw.hub_ws_url.trim(),
    app_id: raw.app_id?.trim() || "chat",
    ...(instanceId ? { instance_id: instanceId } : {}),
  };
}

export function formatDirectPlatform(appId: string, instanceId: string): string {
  return formatSapPlatform(appId, instanceId);
}

export function defaultChatPlatform(): string {
  return "chat";
}

export { resolveHubRpcWsUrl };
