import { logComponent } from "@freeanima/legacy-kernel";
import { withDiscordRetry } from "./discord/discord-retry.ts";
import type { CronDeliverTarget } from "@freeanima/legacy-runtime";
import { registerCronDeliverer, unregisterCronDeliverer } from "@freeanima/legacy-runtime";
import type { Client, TextBasedChannel } from "discord.js";

import { sendText } from "./weixin/ilink-api.ts";

const DISCORD_MAX_LEN = 2000;

function splitMessage(text: string): string[] {
  if (text.length <= DISCORD_MAX_LEN) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > DISCORD_MAX_LEN) {
    let cut = rest.lastIndexOf("\n", DISCORD_MAX_LEN);
    if (cut < DISCORD_MAX_LEN / 2) cut = DISCORD_MAX_LEN;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendDiscord(client: Client, target: CronDeliverTarget, text: string): Promise<void> {
  const channelId = target.thread_id ?? target.chat_id;
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error(`Discord channel ${channelId} is not text-based`);
  }
  const textChannel = channel as TextBasedChannel;
  if (!("send" in textChannel) || typeof textChannel.send !== "function") {
    throw new Error(`Discord channel ${channelId} cannot send messages`);
  }
  for (const chunk of splitMessage(text)) {
    await withDiscordRetry(async () => {
      await textChannel.send(chunk);
    });
  }
}

export function registerDiscordCronDeliverer(client: Client): void {
  registerCronDeliverer("discord", (target, text) => sendDiscord(client, target, text));
}

export function unregisterDiscordCronDeliverer(): void {
  unregisterCronDeliverer("discord");
}

export function registerWeixinCronDeliverer(params: {
  baseUrl: string;
  token: string;
  clientId: string;
  contextTokens: Record<string, string>;
}): void {
  registerCronDeliverer("weixin", async (target, text) => {
    const contextToken = params.contextTokens[target.chat_id] ?? "";
    await sendText(
      params.baseUrl,
      params.token,
      target.chat_id,
      text,
      params.clientId,
      contextToken,
    );
  });
}

export function unregisterWeixinCronDeliverer(): void {
  unregisterCronDeliverer("weixin");
}

export function logCronDeliverRegistration(platform: string): void {
  logComponent("cron").info(`Cron deliverer registered: ${platform}`, { platform });
}

export function warnCronDeliverFailure(platform: string, e: unknown): void {
  logComponent("cron-deliver").error(`Cron deliver registration failed for ${platform}`, {
    err: e,
  });
}
