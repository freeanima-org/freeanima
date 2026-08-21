import { omitUndefined } from "@freeanima/habitat/core/util";
import type { ActionRowBuilder, ButtonBuilder, Message, TextBasedChannel } from "discord.js";
import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import { chunkText } from "../chunk-text.ts";
import type { ClarifyPendingRegistry } from "./discord-clarify-pending.ts";
import {
  createDiscordAnswerStrategy,
  createDiscordCleanupStrategy,
  createDiscordGatewayToolRoundStrategy,
  createStreamChannelComposer,
  DISCORD_ANSWER_SPLIT_AT,
} from "../stream-strategies/index.ts";
import { bagGetTimeout } from "../stream-strategies/types.ts";
import type { ToolDisplayMode } from "../tool-display.ts";
import { DEFAULT_TOOL_DISPLAY_MODE } from "../tool-display.ts";
import { runStreamChannel, type RunStreamChannelOptions } from "../stream-state/run-channel.ts";
import {
  deliverDiscordFinalContent,
  tryDiscordInterimEdit,
  withDiscordRetry,
} from "./discord-retry.ts";

export {
  DISCORD_ANSWER_EDIT_MS,
  DISCORD_ANSWER_SPLIT_AT,
} from "../stream-strategies/discord-answer.ts";

const DISCORD_MAX_LEN = 2000;

function splitDiscordMessage(text: string, limit = DISCORD_MAX_LEN): string[] {
  return chunkText(text, limit, { maxChunkLength: DISCORD_MAX_LEN });
}

export type DiscordStreamChannelOptions = RunStreamChannelOptions & {
  toolDisplayMode?: ToolDisplayMode;
  conversationId?: string;
  clarifyPending?: ClarifyPendingRegistry;
};

export async function streamReplyToChannel(
  channel: TextBasedChannel,
  events: AsyncIterable<StreamEvent>,
  opts?: DiscordStreamChannelOptions,
): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;

  let answerMsg: Message | null = null;
  // discord.js TextBasedChannel.send 重载在 bind 后丢失
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discord.js channel.send 边界
  const channelSend = channel.send.bind(channel) as (
    content: string | { content: string; components?: unknown[] },
  ) => Promise<Message>;

  const sendChunked = async (text: string): Promise<void> => {
    for (const chunk of splitDiscordMessage(text)) {
      await withDiscordRetry(async (): Promise<void> => {
        await channelSend(chunk);
      });
    }
  };

  const sendClarifyWithComponents = async (
    content: string,
    components: ActionRowBuilder<ButtonBuilder>[],
    timeoutSec: number,
  ): Promise<void> => {
    const message = await withDiscordRetry(async (): Promise<Message> =>
      channelSend({ content, components }),
    );
    if (opts?.conversationId && opts.clarifyPending) {
      opts.clarifyPending.register(opts.conversationId, message, timeoutSec);
    }
  };

  const answerIo = {
    send: async (text: string): Promise<void> => {
      answerMsg = await withDiscordRetry(async (): Promise<Message> => channelSend(text));
    },
    edit: async (text: string): Promise<void> => {
      if (!answerMsg) {
        answerMsg = await withDiscordRetry(async (): Promise<Message> => channelSend(text));
        return;
      }
      await tryDiscordInterimEdit(async () => {
        if (!answerMsg) return;
        await answerMsg.edit({ content: text });
      });
    },
  };

  const toolDisplayMode = opts?.toolDisplayMode ?? DEFAULT_TOOL_DISPLAY_MODE;
  const toolStrategy = createDiscordGatewayToolRoundStrategy(
    async (text) => {
      await sendChunked(text);
    },
    async (content, rows, timeoutSec) => {
      await sendClarifyWithComponents(content, rows, timeoutSec);
    },
    toolDisplayMode,
    opts?.conversationId,
  );

  const answerStrategy = createDiscordAnswerStrategy({ io: answerIo });
  const finalizeHandle = answerStrategy.handle.bind(answerStrategy);
  answerStrategy.handle = async (effect, ctx) => {
    if (effect.kind === "answer_finalize") {
      clearThrottleInBag(ctx);
      const text = effect.content.trim();
      if (!text) {
        clearAnswerBagInCtx(ctx);
        return [];
      }
      const chunks = splitDiscordMessage(text, DISCORD_ANSWER_SPLIT_AT);
      if (!answerMsg) {
        for (const chunk of chunks) {
          await withDiscordRetry(async (): Promise<void> => {
            await channelSend(chunk);
          });
        }
        clearAnswerBagInCtx(ctx);
        return [];
      }
      const first = chunks[0] ?? "\u3164";
      await deliverDiscordFinalContent(
        async () => {
          if (!answerMsg) return;
          await answerMsg.edit({ content: first });
        },
        async () => {
          await channelSend(first);
        },
        { phase: "finalize" },
      );
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk === undefined) continue;
        await withDiscordRetry(async (): Promise<void> => {
          await channelSend(chunk);
        });
      }
      answerMsg = null;
      clearAnswerBagInCtx(ctx);
      return [];
    }
    if (effect.kind === "answer_commit") {
      const result = await finalizeHandle(effect, ctx);
      if (effect.content.trim()) {
        answerMsg = null;
      }
      return result;
    }
    return finalizeHandle(effect, ctx);
  };

  const composer = createStreamChannelComposer({
    strategies: [toolStrategy, answerStrategy, createDiscordCleanupStrategy(answerIo)],
    io: {},
    ...omitUndefined({ signal: opts?.signal }),
  });

  await runStreamChannel(events, composer, { ...opts, platform: "discord", toolDisplayMode });
}

function clearThrottleInBag(ctx: { bag: Map<string, unknown> }): void {
  const key = "discord.throttleTimer";
  const timer = bagGetTimeout(ctx.bag, key);
  if (timer) {
    clearTimeout(timer);
    ctx.bag.delete(key);
  }
}

function clearAnswerBagInCtx(ctx: { bag: Map<string, unknown> }): void {
  ctx.bag.delete("discord.answerOpen");
  ctx.bag.delete("discord.answerBuffer");
  ctx.bag.delete("discord.firstFlushGate");
}
