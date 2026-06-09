import { loadConfig, patchConfigSection } from "@freeanima/service-config";

export type HomeChannel = {
  chat_id: string;
  thread_id?: string;
};

export function getHomeChannel(platform: string): HomeChannel | null {
  const cfg = loadConfig() as Record<string, unknown>;
  const section = cfg[platform] as Record<string, unknown> | undefined;
  if (!section) return null;
  const chatId = String(section.home_channel ?? "").trim();
  if (!chatId) return null;
  const threadId = String(section.home_thread_id ?? "").trim();
  return threadId ? { chat_id: chatId, thread_id: threadId } : { chat_id: chatId };
}

export function setHomeChannel(platform: string, chatId: string, threadId?: string): void {
  patchConfigSection(platform, {
    home_channel: chatId,
    home_thread_id: threadId ?? "",
  });
}
