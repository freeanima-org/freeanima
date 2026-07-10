/// <reference lib="dom" />
import { formatSapPlatform } from "./naming.ts";

export type DirectSatelliteConfig = {
  hub_ws_url: string;
  app_id: string;
  instance_id?: string;
};

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
