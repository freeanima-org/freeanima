/// <reference lib="dom" />
import { asRecord } from "@freeanima/shared/util";
import { formatRemotePlatform } from "./naming.ts";

export type DirectOutpostConfig = {
  habitat_ws_url: string;
  app_id: string;
  instance_id?: string;
};

export async function loadDirectOutpostConfig(
  configUrl = "/config.json",
): Promise<DirectOutpostConfig> {
  const res = await fetch(configUrl);
  if (!res.ok) {
    throw new Error(`加载 config 失败: HTTP ${res.status}`);
  }
  const raw: unknown = await res.json();
  const record = asRecord(raw);
  if (!record) {
    throw new Error("config.json 不是对象");
  }
  const ws = typeof record.habitat_ws_url === "string" ? record.habitat_ws_url.trim() : "";
  if (!ws) {
    throw new Error("config.json 缺少 habitat_ws_url");
  }
  const instanceId = typeof record.instance_id === "string" ? record.instance_id.trim() : undefined;
  return {
    habitat_ws_url: ws,
    app_id:
      typeof record.app_id === "string" && record.app_id.trim() ? record.app_id.trim() : "chat",
    ...(instanceId ? { instance_id: instanceId } : {}),
  };
}

export function formatDirectPlatform(appId: string, instanceId: string): string {
  return formatRemotePlatform(appId, instanceId);
}

export function defaultChatPlatform(): string {
  return "chat";
}
