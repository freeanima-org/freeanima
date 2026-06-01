import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig, patchConfigSection } from "@freeanima/kernel";

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

/** 若 config 尚无 home_channel，从 Hermes ~/.hermes/.env 预填 */
export function seedHomeChannelsFromHermes(): void {
  for (const platform of ["discord", "weixin"] as const) {
    if (getHomeChannel(platform)) continue;
    const fromEnv = readHermesHomeEnv(platform);
    if (fromEnv) {
      setHomeChannel(platform, fromEnv.chat_id, fromEnv.thread_id);
    }
  }
}

function readHermesHomeEnv(platform: "discord" | "weixin"): HomeChannel | null {
  const envPath = join(homedir(), ".hermes", ".env");
  if (!existsSync(envPath)) return null;
  const prefix = platform === "discord" ? "DISCORD_HOME_CHANNEL" : "WEIXIN_HOME_CHANNEL";
  const threadPrefix =
    platform === "discord" ? "DISCORD_HOME_CHANNEL_THREAD_ID" : "WEIXIN_HOME_CHANNEL_THREAD_ID";
  let chatId = "";
  let threadId = "";
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${prefix}=`)) {
      chatId = trimmed.slice(prefix.length + 1).trim();
    } else if (trimmed.startsWith(`${threadPrefix}=`)) {
      threadId = trimmed.slice(threadPrefix.length + 1).trim();
    }
  }
  if (!chatId) return null;
  return threadId ? { chat_id: chatId, thread_id: threadId } : { chat_id: chatId };
}
