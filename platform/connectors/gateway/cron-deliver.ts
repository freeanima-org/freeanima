import { logComponent } from "@freeanima/platform/logging";
import { withDiscordRetry, deliverDiscordFinalContent } from "./discord/discord-retry.ts";
import {
  registerCronDeliverer,
  unregisterCronDeliverer,
  type CronDeliverOptions,
  type CronDeliverResult,
  type CronDeliverTarget,
} from "@freeanima/platform/connectors/cron";
import type { Client, Message, TextBasedChannel } from "discord.js";

import { splitDeliverText } from "./stream-strategies/deliver-text.ts";
import { sendTextChunked } from "./weixin/ilink-api.ts";

async function resolveTextChannel(
  client: Client,
  target: CronDeliverTarget,
): Promise<TextBasedChannel & { send: (content: string) => Promise<Message> }> {
  const channelId = target.thread_id ?? target.chat_id;
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error(`Discord channel ${channelId} is not text-based`);
  }
  const textChannel = channel as TextBasedChannel;
  if (!("send" in textChannel) || typeof textChannel.send !== "function") {
    throw new Error(`Discord channel ${channelId} cannot send messages`);
  }
  return textChannel as TextBasedChannel & { send: (content: string) => Promise<Message> };
}

async function sendDiscord(
  client: Client,
  target: CronDeliverTarget,
  text: string,
  opts?: CronDeliverOptions,
): Promise<CronDeliverResult | void> {
  const textChannel = await resolveTextChannel(client, target);
  const chunks = splitDeliverText(text);
  const primary = chunks[0] ?? "";

  if (opts?.editMessageId) {
    const editId = opts.editMessageId;
    await deliverDiscordFinalContent(
      async () => {
        const msg = await textChannel.messages.fetch(editId);
        await msg.edit({ content: primary });
      },
      async () => {
        const sent = await textChannel.send(primary);
        if (sent.id !== editId) {
          logComponent("cron-deliver").warn("Discord progress fallback sent new message", {
            channelId: target.thread_id ?? target.chat_id,
          });
        }
      },
      { phase: "acp-progress" },
    );
    for (const chunk of chunks.slice(1)) {
      await withDiscordRetry(async () => {
        await textChannel.send(chunk);
      });
    }
    return { messageId: editId };
  }

  let firstId: string | undefined;
  for (const chunk of chunks) {
    const sent = await withDiscordRetry(async () => textChannel.send(chunk));
    if (!firstId) firstId = sent.id;
  }
  return firstId ? { messageId: firstId } : undefined;
}

export function registerDiscordCronDeliverer(client: Client): void {
  registerCronDeliverer("discord", (target, text, opts) => sendDiscord(client, target, text, opts));
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
  registerCronDeliverer("weixin", async (target, text, _opts) => {
    const contextToken = params.contextTokens[target.chat_id] ?? "";
    await sendTextChunked(
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
