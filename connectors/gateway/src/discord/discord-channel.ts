import type { Message, TextBasedChannel } from "discord.js";
import type { StreamEvent } from "@freeanima/orchestration-loop";
import { chunkText } from "../chunk-text.ts";
import {
  createDiscordAnswerStrategy,
  createDiscordCleanupStrategy,
  createStreamChannelComposer,
  createToolRoundStrategy,
  DISCORD_ANSWER_SPLIT_AT,
} from "../stream-strategies/index.ts";
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

export type DiscordStreamChannelOptions = RunStreamChannelOptions;

export async function streamReplyToChannel(
  channel: TextBasedChannel,
  events: AsyncIterable<StreamEvent>,
  opts?: DiscordStreamChannelOptions,
): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;

  let answerMsg: Message | null = null;
  const channelSend = channel.send.bind(channel) as (content: string) => Promise<Message>;

  const sendChunked = async (text: string): Promise<void> => {
    for (const chunk of splitDiscordMessage(text)) {
      await withDiscordRetry(async (): Promise<void> => {
        await channelSend(chunk);
      });
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
        await answerMsg!.edit({ content: text });
      });
    },
  };

  const toolStrategy = createToolRoundStrategy();
  const toolHandle = toolStrategy.handle.bind(toolStrategy);
  toolStrategy.handle = async (effect, ctx) => {
    const actions = await toolHandle(effect, ctx);
    for (const action of actions) {
      if (action.op === "send") await sendChunked(action.text);
    }
    return [];
  };

  const answerStrategy = createDiscordAnswerStrategy({ io: answerIo });
  const finalizeHandle = answerStrategy.handle.bind(answerStrategy);
  answerStrategy.handle = async (effect, ctx) => {
    if (effect.kind === "answer_finalize") {
      clearThrottleInBag(ctx);
      const text = effect.content.trim();
      if (!text) return [];
      const chunks = splitDiscordMessage(text, DISCORD_ANSWER_SPLIT_AT);
      if (!answerMsg) {
        for (const chunk of chunks) {
          await withDiscordRetry(async (): Promise<void> => {
            await channelSend(chunk);
          });
        }
        return [];
      }
      const first = chunks[0] ?? "\u3164";
      await deliverDiscordFinalContent(
        async () => {
          await answerMsg!.edit({ content: first });
        },
        async () => {
          await channelSend(first);
        },
        { phase: "finalize" },
      );
      for (let i = 1; i < chunks.length; i++) {
        await withDiscordRetry(async (): Promise<void> => {
          await channelSend(chunks[i]!);
        });
      }
      answerMsg = null;
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
    signal: opts?.signal,
  });

  await runStreamChannel(events, composer, { ...opts, platform: "discord" });
}

function clearThrottleInBag(ctx: { bag: Map<string, unknown> }): void {
  const key = "discord.throttleTimer";
  const timer = ctx.bag.get(key) as ReturnType<typeof setTimeout> | undefined;
  if (timer) {
    clearTimeout(timer);
    ctx.bag.delete(key);
  }
}
