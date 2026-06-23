import type { Client, Message } from "discord.js";

import { logComponent } from "@freeanima/platform/logging";

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

  register(sessionId: string, message: Message, timeoutSec: number): void {
    this.clearTimer(sessionId);
    const timeoutHandle = setTimeout(() => {
      void this.disable(sessionId, TIMEOUT_SUFFIX);
    }, timeoutSec * 1000);
    this.pending.set(sessionId, {
      messageId: message.id,
      channelId: message.channelId,
      timeoutHandle,
    });
  }

  async clear(sessionId: string): Promise<void> {
    await this.disable(sessionId);
  }

  async disable(sessionId: string, contentSuffix?: string): Promise<void> {
    const entry = this.pending.get(sessionId);
    if (!entry) return;
    this.clearTimer(sessionId);
    await this.disableMessage(entry.channelId, entry.messageId, contentSuffix);
  }

  disposeAll(): void {
    for (const sessionId of [...this.pending.keys()]) {
      this.clearTimer(sessionId);
    }
    this.pending.clear();
  }

  private clearTimer(sessionId: string): void {
    const entry = this.pending.get(sessionId);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    this.pending.delete(sessionId);
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
