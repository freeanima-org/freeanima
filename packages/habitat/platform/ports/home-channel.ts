import type { Config } from "@freeanima/habitat/core/config";
import { coerceString } from "@freeanima/shared/coerce-string";
import { asRecord } from "@freeanima/shared/util";
import {
  getActiveRuntimeConfig,
  isPatchableRuntimeConfig,
  patchRuntimeConfigSection,
} from "@freeanima/habitat/platform/config";

import { platformPorts } from "./service.ts";

export type HomeChannel = {
  chat_id: string;
  thread_id?: string;
};

/** Composition root binds the runtime config onto `ctx.platformPorts`. */
export function bindHomeChannelConfig(config: Config): void {
  platformPorts().homeChannelConfig = config;
}

export function resetHomeChannelConfigForTest(): void {
  platformPorts().homeChannelConfig = null;
}

function requireHomeChannelConfig(): Config {
  const config = platformPorts().homeChannelConfig;
  if (!config) {
    throw new Error("Home channel config not bound; call bindHomeChannelConfig first");
  }
  return config;
}

export function getHomeChannel(platform: string): HomeChannel | null {
  let cfg: Record<string, unknown>;
  try {
    cfg = getActiveRuntimeConfig().data;
  } catch {
    cfg = requireHomeChannelConfig().data;
  }
  const section = asRecord(cfg[platform]);
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
  const data = { ...config.data };
  const existing = asRecord(data[platform]) ?? {};
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
