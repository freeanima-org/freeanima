import type { Client, Message } from "discord.js";

import { logComponent } from "@freeanima/habitat/platform/logging";

import { disabledActionRowsFromMessage } from "./discord-clarify-components.ts";
import { withDiscordRetry } from "./discord-retry.ts";

type PendingClarify = {
  messageId: string;
  channelId: string;
  timeoutHandle: ReturnType<typeof setTimeout>;
};

const TIMEOUT_SUFFIX = "\n\n_(已超时，请重新发起)_";

export class ClarifyPendingRegistry {
  private readonly pending = new Map<string, PendingClarify>();

  constructor(private readonly client: Client) {}

  register(conversationId: string, message: Message, timeoutSec: number): void {
    this.clearTimer(conversationId);
    const timeoutHandle = setTimeout(() => {
      void this.disable(conversationId, TIMEOUT_SUFFIX);
    }, timeoutSec * 1000);
    this.pending.set(conversationId, {
      messageId: message.id,
      channelId: message.channelId,
      timeoutHandle,
    });
  }

  async clear(conversationId: string): Promise<void> {
    await this.disable(conversationId);
  }

  async disable(conversationId: string, contentSuffix?: string): Promise<void> {
    const entry = this.pending.get(conversationId);
    if (!entry) return;
    this.clearTimer(conversationId);
    await this.disableMessage(entry.channelId, entry.messageId, contentSuffix);
  }

  disposeAll(): void {
    for (const conversationId of this.pending.keys()) {
      this.clearTimer(conversationId);
    }
    this.pending.clear();
  }

  private clearTimer(conversationId: string): void {
    const entry = this.pending.get(conversationId);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    this.pending.delete(conversationId);
  }

  private async disableMessage(
    channelId: string,
    messageId: string,
    contentSuffix?: string,
  ): Promise<void> {
    try {
      const channel = await withDiscordRetry(() => this.client.channels.fetch(channelId));
      if (!channel?.isTextBased()) return;
      const message = await withDiscordRetry(() => channel.messages.fetch(messageId));
      const components = disabledActionRowsFromMessage(message);
      const content = contentSuffix ? `${message.content}${contentSuffix}` : message.content;
      await withDiscordRetry(() => message.edit({ content, components }));
    } catch (e) {
      logComponent("discord").debug("Discord clarify button disable skipped", {
        channel_id: channelId,
        message_id: messageId,
        err: e,
      });
    }
  }
}
