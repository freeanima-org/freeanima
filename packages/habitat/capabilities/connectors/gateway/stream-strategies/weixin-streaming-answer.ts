import type { StreamEffect } from "../stream-state/types.ts";
import {
  createFirstFlushGate,
  type FirstFlushGate,
  STREAM_FIRST_FLUSH_MAX_WAIT_MS,
  STREAM_FIRST_FLUSH_MIN_CHARS,
} from "./first-flush-gate.ts";
import type { ChannelAction, StreamStrategy, StrategyContext } from "./types.ts";
import { bagGetGate, bagGetNumber, bagGetString, bagGetTimeout } from "./types.ts";

export const WEIXIN_ANSWER_SEND_MS = 3000;

const BAG_BUFFER = "weixin.answerBuffer";
const BAG_SENT = "weixin.answerSentLen";
const BAG_THROTTLE = "weixin.throttleTimer";
const BAG_OPEN = "weixin.answerOpen";
const BAG_GATE = "weixin.firstFlushGate";

export type WeixinAnswerIo = {
  send: (text: string) => Promise<void>;
};

function clearThrottle(ctx: StrategyContext): void {
  const existing = bagGetTimeout(ctx.bag, BAG_THROTTLE);
  if (existing) {
    clearTimeout(existing);
    ctx.bag.delete(BAG_THROTTLE);
  }
}

function getGate(ctx: StrategyContext): FirstFlushGate | undefined {
  return bagGetGate(ctx.bag, BAG_GATE);
}

function disposeGate(ctx: StrategyContext): void {
  getGate(ctx)?.dispose();
  ctx.bag.delete(BAG_GATE);
}

export type WeixinStreamingAnswerStrategyOptions = {
  io: WeixinAnswerIo;
  sendIntervalMs?: number;
  firstFlushMinChars?: number;
  firstFlushMaxWaitMs?: number;
};

export function createWeixinStreamingAnswerStrategy(
  opts: WeixinStreamingAnswerStrategyOptions,
): StreamStrategy {
  const sendIntervalMs = opts.sendIntervalMs ?? WEIXIN_ANSWER_SEND_MS;
  const { io } = opts;
  const gateOpts = {
    minChars: opts.firstFlushMinChars ?? STREAM_FIRST_FLUSH_MIN_CHARS,
    maxWaitMs: opts.firstFlushMaxWaitMs ?? STREAM_FIRST_FLUSH_MAX_WAIT_MS,
  };

  const flushDelta = async (ctx: StrategyContext): Promise<void> => {
    if (!ctx.bag.get(BAG_OPEN)) return;
    const buffer = bagGetString(ctx.bag, BAG_BUFFER) ?? "";
    const sentLen = bagGetNumber(ctx.bag, BAG_SENT) ?? 0;
    const delta = buffer.slice(sentLen).trim();
    if (!delta) return;
    ctx.bag.set(BAG_SENT, buffer.length);
    await io.send(delta);
  };

  const scheduleThrottle = (ctx: StrategyContext): void => {
    clearThrottle(ctx);
    ctx.bag.set(
      BAG_THROTTLE,
      setTimeout(() => {
        ctx.bag.delete(BAG_THROTTLE);
        void flushDelta(ctx);
      }, sendIntervalMs),
    );
  };

  const openFirstFlush = async (ctx: StrategyContext, schedule = true): Promise<void> => {
    await flushDelta(ctx);
    if (schedule) scheduleThrottle(ctx);
  };

  return {
    name: "weixin-streaming-answer",
    async handle(effect: StreamEffect, ctx: StrategyContext): Promise<ChannelAction[]> {
      switch (effect.kind) {
        case "answer_open": {
          if (ctx.bag.get(BAG_OPEN)) return [];
          ctx.bag.set(BAG_OPEN, true);
          ctx.bag.set(BAG_BUFFER, "");
          ctx.bag.set(BAG_SENT, 0);
          ctx.bag.set(BAG_GATE, createFirstFlushGate(gateOpts));
          return [];
        }
        case "answer_delta": {
          const next = `${bagGetString(ctx.bag, BAG_BUFFER) ?? ""}${effect.delta}`;
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
          disposeGate(ctx);
          ctx.bag.set(BAG_BUFFER, effect.content);
          ctx.bag.set(BAG_SENT, 0);
          clearThrottle(ctx);
          if (effect.content.trim()) await io.send(effect.content.trim());
          ctx.bag.set(BAG_SENT, effect.content.length);
          return [];
        }
        case "answer_commit": {
          clearThrottle(ctx);
          const gate = getGate(ctx);
          if (gate && !gate.isOpen()) {
            await gate.flushPending(() => openFirstFlush(ctx, false));
          } else {
            await flushDelta(ctx);
          }
          disposeGate(ctx);
          ctx.bag.set(BAG_BUFFER, "");
          ctx.bag.set(BAG_SENT, 0);
          ctx.bag.delete(BAG_OPEN);
          return [];
        }
        case "answer_finalize": {
          clearThrottle(ctx);
          const gate = getGate(ctx);
          if (gate && !gate.isOpen()) {
            await gate.flushPending(() => openFirstFlush(ctx, false));
          } else {
            await flushDelta(ctx);
          }
          disposeGate(ctx);
          const buffer = bagGetString(ctx.bag, BAG_BUFFER) ?? "";
          const sentLen = bagGetNumber(ctx.bag, BAG_SENT) ?? 0;
          const tail = buffer.slice(sentLen).trim();
          ctx.bag.set(BAG_BUFFER, "");
          ctx.bag.set(BAG_SENT, 0);
          ctx.bag.delete(BAG_OPEN);
          if (tail) await io.send(tail);
          else if (!sentLen && buffer.trim()) await io.send(buffer.trim());
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
        await flushDelta(ctx);
      }
      return [];
    },
    async dispose(ctx: StrategyContext): Promise<void> {
      clearThrottle(ctx);
      disposeGate(ctx);
      ctx.bag.delete(BAG_OPEN);
      ctx.bag.delete(BAG_BUFFER);
      ctx.bag.delete(BAG_SENT);
    },
  };
}
