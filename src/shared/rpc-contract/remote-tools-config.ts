/// <reference lib="dom" />
import { formatRemotePlatform } from "./naming.ts";

export type DirectSatelliteConfig = {
  habitat_ws_url: string;
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
  const raw = (await res.json()) as Partial<{
    habitat_ws_url?: string;
    app_id?: string;
    instance_id?: string;
  }>;
  const ws = raw.habitat_ws_url?.trim() || "";
  if (!ws) {
    throw new Error("config.json 缺少 habitat_ws_url");
  }
  const instanceId = raw.instance_id?.trim();
  return {
    habitat_ws_url: ws,
    app_id: raw.app_id?.trim() || "chat",
    ...(instanceId ? { instance_id: instanceId } : {}),
  };
}

export function formatDirectPlatform(appId: string, instanceId: string): string {
  return formatRemotePlatform(appId, instanceId);
}

export function defaultChatPlatform(): string {
  return "chat";
}
