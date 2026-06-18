import type { StreamEffect } from "../stream-state/types.ts";
import type { ChannelAction, StreamStrategy, StrategyContext } from "./types.ts";

export const WEIXIN_ANSWER_SEND_MS = 3000;

const BAG_BUFFER = "weixin.answerBuffer";
const BAG_SENT = "weixin.answerSentLen";
const BAG_THROTTLE = "weixin.throttleTimer";
const BAG_OPEN = "weixin.answerOpen";

export type WeixinAnswerIo = {
  send: (text: string) => Promise<void>;
};

function clearThrottle(ctx: StrategyContext): void {
  const existing = ctx.bag.get(BAG_THROTTLE) as ReturnType<typeof setTimeout> | undefined;
  if (existing) {
    clearTimeout(existing);
    ctx.bag.delete(BAG_THROTTLE);
  }
}

export type WeixinStreamingAnswerStrategyOptions = {
  io: WeixinAnswerIo;
  sendIntervalMs?: number;
};

export function createWeixinStreamingAnswerStrategy(
  opts: WeixinStreamingAnswerStrategyOptions,
): StreamStrategy {
  const sendIntervalMs = opts.sendIntervalMs ?? WEIXIN_ANSWER_SEND_MS;
  const { io } = opts;

  const flushDelta = async (ctx: StrategyContext): Promise<void> => {
    if (!ctx.bag.get(BAG_OPEN)) return;
    const buffer = (ctx.bag.get(BAG_BUFFER) as string | undefined) ?? "";
    const sentLen = (ctx.bag.get(BAG_SENT) as number | undefined) ?? 0;
    const delta = buffer.slice(sentLen).trim();
    if (!delta) return;
    ctx.bag.set(BAG_SENT, buffer.length);
    await io.send(delta);
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
          return [];
        }
        case "answer_delta": {
          const next = `${(ctx.bag.get(BAG_BUFFER) as string | undefined) ?? ""}${effect.delta}`;
          ctx.bag.set(BAG_BUFFER, next);
          const sentLen = (ctx.bag.get(BAG_SENT) as number | undefined) ?? 0;
          if (sentLen === 0 && next.trim()) {
            await flushDelta(ctx);
            return [];
          }
          clearThrottle(ctx);
          ctx.bag.set(
            BAG_THROTTLE,
            setTimeout(() => {
              ctx.bag.delete(BAG_THROTTLE);
              void flushDelta(ctx);
            }, sendIntervalMs),
          );
          return [];
        }
        case "answer_replace": {
          ctx.bag.set(BAG_BUFFER, effect.content);
          ctx.bag.set(BAG_SENT, 0);
          clearThrottle(ctx);
          if (effect.content.trim()) await io.send(effect.content.trim());
          ctx.bag.set(BAG_SENT, effect.content.length);
          return [];
        }
        case "answer_commit": {
          clearThrottle(ctx);
          ctx.bag.set(BAG_BUFFER, "");
          ctx.bag.set(BAG_SENT, 0);
          ctx.bag.delete(BAG_OPEN);
          return [];
        }
        case "answer_finalize": {
          clearThrottle(ctx);
          const buffer = (ctx.bag.get(BAG_BUFFER) as string | undefined) ?? "";
          const sentLen = (ctx.bag.get(BAG_SENT) as number | undefined) ?? 0;
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
      await flushDelta(ctx);
      return [];
    },
    async dispose(ctx: StrategyContext): Promise<void> {
      clearThrottle(ctx);
      ctx.bag.delete(BAG_OPEN);
      ctx.bag.delete(BAG_BUFFER);
      ctx.bag.delete(BAG_SENT);
    },
  };
}
