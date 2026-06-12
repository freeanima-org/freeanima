import type { Config } from "@freeanima/storage-config";
import { FileConfig } from "@freeanima/service-config";

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
  const cfg = requireHomeChannelConfig().data as Record<string, unknown>;
  const section = cfg[platform] as Record<string, unknown> | undefined;
  if (!section) return null;
  const chatId = String(section.home_channel ?? "").trim();
  if (!chatId) return null;
  const threadId = String(section.home_thread_id ?? "").trim();
  return threadId ? { chat_id: chatId, thread_id: threadId } : { chat_id: chatId };
}

export function setHomeChannel(platform: string, chatId: string, threadId?: string): void {
  const config = requireHomeChannelConfig();
  if (!(config instanceof FileConfig)) {
    throw new Error("setHomeChannel requires FileConfig");
  }
  config.patchSection(platform, {
    home_channel: chatId,
    home_thread_id: threadId ?? "",
  });
}
