import type { StreamEffect } from "../stream-state/types.ts";
import {
  createFirstFlushGate,
  type FirstFlushGate,
  STREAM_FIRST_FLUSH_MAX_WAIT_MS,
  STREAM_FIRST_FLUSH_MIN_CHARS,
} from "./first-flush-gate.ts";
import type { ChannelAction, StreamStrategy, StrategyContext } from "./types.ts";

export const DISCORD_STREAM_PLACEHOLDER = "⏳ Thinking…";
export const DISCORD_ANSWER_EDIT_MS = 3000;
export const DISCORD_ANSWER_SPLIT_AT = 1000;

const BAG_ANSWER_OPEN = "discord.answerOpen";
const BAG_BUFFER = "discord.answerBuffer";
const BAG_THROTTLE = "discord.throttleTimer";
const BAG_GATE = "discord.firstFlushGate";

export type DiscordAnswerIo = {
  send: (text: string) => Promise<void>;
  edit: (text: string) => Promise<void>;
};

function displayText(buffer: string, placeholder: string): string {
  const trimmed = buffer.trim();
  if (!trimmed) return placeholder;
  return trimmed.length <= 2000 ? trimmed : trimmed.slice(-2000);
}

function clearThrottle(ctx: StrategyContext): void {
  const existing = ctx.bag.get(BAG_THROTTLE) as ReturnType<typeof setTimeout> | undefined;
  if (existing) {
    clearTimeout(existing);
    ctx.bag.delete(BAG_THROTTLE);
  }
}

function getGate(ctx: StrategyContext): FirstFlushGate | undefined {
  return ctx.bag.get(BAG_GATE) as FirstFlushGate | undefined;
}

function disposeGate(ctx: StrategyContext): void {
  getGate(ctx)?.dispose();
  ctx.bag.delete(BAG_GATE);
}

export type DiscordAnswerStrategyOptions = {
  io: DiscordAnswerIo;
  placeholder?: string;
  editIntervalMs?: number;
  finalizeSplitAt?: number;
  firstFlushMinChars?: number;
  firstFlushMaxWaitMs?: number;
};

export function createDiscordAnswerStrategy(opts: DiscordAnswerStrategyOptions): StreamStrategy {
  const placeholder = opts.placeholder ?? DISCORD_STREAM_PLACEHOLDER;
  const editIntervalMs = opts.editIntervalMs ?? DISCORD_ANSWER_EDIT_MS;
  const finalizeSplitAt = opts.finalizeSplitAt ?? DISCORD_ANSWER_SPLIT_AT;
  const { io } = opts;
  const gateOpts = {
    minChars: opts.firstFlushMinChars ?? STREAM_FIRST_FLUSH_MIN_CHARS,
    maxWaitMs: opts.firstFlushMaxWaitMs ?? STREAM_FIRST_FLUSH_MAX_WAIT_MS,
  };

  const flushInterim = async (ctx: StrategyContext): Promise<void> => {
    if (!ctx.bag.get(BAG_ANSWER_OPEN)) return;
    const buffer = (ctx.bag.get(BAG_BUFFER) as string | undefined) ?? "";
    await io.edit(displayText(buffer, placeholder));
  };

  const scheduleThrottle = (ctx: StrategyContext): void => {
    clearThrottle(ctx);
    ctx.bag.set(
      BAG_THROTTLE,
      setTimeout(() => {
        ctx.bag.delete(BAG_THROTTLE);
        void flushInterim(ctx);
      }, editIntervalMs),
    );
  };

  const openFirstFlush = async (ctx: StrategyContext, schedule = true): Promise<void> => {
    await flushInterim(ctx);
    if (schedule) scheduleThrottle(ctx);
  };

  return {
    name: "discord-answer",
    async handle(effect: StreamEffect, ctx: StrategyContext): Promise<ChannelAction[]> {
      switch (effect.kind) {
        case "answer_open": {
          if (ctx.bag.get(BAG_ANSWER_OPEN)) return [];
          ctx.bag.set(BAG_ANSWER_OPEN, true);
          ctx.bag.set(BAG_BUFFER, "");
          ctx.bag.set(BAG_GATE, createFirstFlushGate(gateOpts));
          await io.send(placeholder);
          return [];
        }
        case "answer_delta": {
          const next = `${(ctx.bag.get(BAG_BUFFER) as string | undefined) ?? ""}${effect.delta}`;
          ctx.bag.set(BAG_BUFFER, next);
          const gate = getGate(ctx);
          if (gate && !gate.isOpen()) {
            gate.onDelta(next, () => openFirstFlush(ctx));
            return [];
          }
          scheduleThrottle(ctx);
          return [];
        }
        case "answer_replace": {
          ctx.bag.set(BAG_BUFFER, effect.content);
          clearThrottle(ctx);
          await io.edit(displayText(effect.content, placeholder));
          return [];
        }
        case "answer_commit": {
          clearThrottle(ctx);
          disposeGate(ctx);
          const text = effect.content.trim();
          ctx.bag.set(BAG_BUFFER, "");
          if (!ctx.bag.get(BAG_ANSWER_OPEN)) return [];
          if (!text) {
            await io.edit("\u3164");
          } else {
            await io.edit(text);
          }
          ctx.bag.delete(BAG_ANSWER_OPEN);
          return [];
        }
        case "answer_finalize": {
          clearThrottle(ctx);
          const gate = getGate(ctx);
          if (gate && !gate.isOpen()) {
            await gate.flushPending(() => openFirstFlush(ctx, false));
          } else {
            await flushInterim(ctx);
          }
          disposeGate(ctx);
          const text = effect.content.trim();
          ctx.bag.set(BAG_BUFFER, "");
          if (!text) return [];
          if (!ctx.bag.get(BAG_ANSWER_OPEN)) {
            await io.send(text);
            return [];
          }
          const chunks =
            text.length <= finalizeSplitAt
              ? [text]
              : [text.slice(0, finalizeSplitAt), text.slice(finalizeSplitAt)];
          const firstChunk = chunks[0];
          if (!firstChunk) return [];
          await io.edit(firstChunk);
          for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk !== undefined) await io.send(chunk);
          }
          ctx.bag.delete(BAG_ANSWER_OPEN);
          return [];
        }
        case "tool_round":
        case "clarify":
          clearThrottle(ctx);
          return [];
        default:
          return [];
      }
    },
    async flush(ctx: StrategyContext): Promise<ChannelAction[]> {
      clearThrottle(ctx);
      const gate = getGate(ctx);
      if (gate && !gate.isOpen()) {
        await gate.flushPending(() => openFirstFlush(ctx, false));
      } else {
        await flushInterim(ctx);
      }
      return [];
    },
    async dispose(ctx: StrategyContext): Promise<void> {
      clearThrottle(ctx);
      disposeGate(ctx);
      ctx.bag.delete(BAG_ANSWER_OPEN);
      ctx.bag.delete(BAG_BUFFER);
    },
  };
}

export function createDiscordCleanupStrategy(io: DiscordAnswerIo): StreamStrategy {
  return {
    name: "discord-cleanup",
    async handle(effect: StreamEffect, ctx: StrategyContext): Promise<ChannelAction[]> {
      if (effect.kind === "turn_end" && effect.reason === "interrupted") {
        const buffer = (ctx.bag.get(BAG_BUFFER) as string | undefined) ?? "";
        if (ctx.bag.get(BAG_ANSWER_OPEN) && buffer.trim()) {
          await io.edit(buffer.trim());
        }
      }
      return [];
    },
    async dispose(ctx: StrategyContext): Promise<void> {
      ctx.bag.clear();
    },
  };
}
