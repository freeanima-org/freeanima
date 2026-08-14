import type { Config } from "@freeanima/habitat/core/config";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  getActiveRuntimeConfig,
  isPatchableRuntimeConfig,
  patchRuntimeConfigSection,
} from "@freeanima/habitat/platform/config";

export type HomeChannel = {
  chat_id: string;
  thread_id?: string;
};

let homeChannelConfig: Config | null = null;

export function bindHomeChannelConfig(config: Config): void {
  homeChannelConfig = config;
}

export function resetHomeChannelConfigForTest(): void {
  homeChannelConfig = null;
}

function requireHomeChannelConfig(): Config {
  if (!homeChannelConfig) {
    throw new Error("Home channel config not bound; call bindHomeChannelConfig first");
  }
  return homeChannelConfig;
}

export function getHomeChannel(platform: string): HomeChannel | null {
  let cfg: Record<string, unknown>;
  try {
    cfg = getActiveRuntimeConfig().data;
  } catch {
    cfg = requireHomeChannelConfig().data;
  }
  const section = cfg[platform] as Record<string, unknown> | undefined;
  if (!section) return null;
  const chatId = coerceString(section.home_channel ?? "").trim();
  if (!chatId) return null;
  const threadId = coerceString(section.home_thread_id ?? "").trim();
  return threadId ? { chat_id: chatId, thread_id: threadId } : { chat_id: chatId };
}

function mergePlatformSectionIntoActive(platform: string, patch: Record<string, unknown>): void {
  const config = getActiveRuntimeConfig();
  if (isPatchableRuntimeConfig(config)) {
    // RuntimeConfigStore.patchSection 已更新内存快照
    return;
  }
  const data = { ...(config.data as Record<string, unknown>) };
  const existing =
    typeof data[platform] === "object" && data[platform] != null && !Array.isArray(data[platform])
      ? { ...(data[platform] as Record<string, unknown>) }
      : {};
  data[platform] = { ...existing, ...patch };
  config.update(data);
}

export async function setHomeChannel(
  platform: string,
  chatId: string,
  threadId?: string,
): Promise<void> {
  const patch = {
    home_channel: chatId,
    home_thread_id: threadId ?? "",
  };
  await patchRuntimeConfigSection(platform, patch);
  mergePlatformSectionIntoActive(platform, patch);
}
