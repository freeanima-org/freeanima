import type { Config } from "@freeanima/core/config";
import { coerceString } from "@freeanima/shared/coerce-string";
import { asRecord, isRecord } from "@freeanima/shared/util";
import { getActiveRuntimeConfig } from "@freeanima/core/config";

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

/** 结构判定：RuntimeConfigStore 自带 patchSection（不再依赖 server 的类型） */
function hasPatchSection(config: unknown): boolean {
  if (!isRecord(config)) return false;
  return typeof config.patchSection === "function";
}

function mergePlatformSectionIntoActive(platform: string, patch: Record<string, unknown>): void {
  const config = getActiveRuntimeConfig();
  if (hasPatchSection(config)) {
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
  const patchSection = platformPorts().patchRuntimeConfigSection;
  if (!patchSection) {
    throw new Error("runtime config patcher not registered: load @freeanima/server first");
  }
  await patchSection(platform, patch);
  mergePlatformSectionIntoActive(platform, patch);
}
