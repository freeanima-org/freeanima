import type { StreamEffect } from "../stream-state/types.ts";
import type { ChannelAction, StreamStrategy, StrategyContext } from "./types.ts";

const BAG_BUFFER = "weixin.answerBuffer";

export function createWeixinBufferedAnswerStrategy(): StreamStrategy {
  return {
    name: "weixin-buffered-answer",
    handle(effect: StreamEffect, ctx: StrategyContext): ChannelAction[] {
      switch (effect.kind) {
        case "answer_delta":
          ctx.bag.set(
            BAG_BUFFER,
            `${(ctx.bag.get(BAG_BUFFER) as string | undefined) ?? ""}${effect.delta}`,
          );
          return [];
        case "answer_replace":
          ctx.bag.set(BAG_BUFFER, effect.content);
          return [];
        case "answer_finalize": {
          const text = effect.content.trim();
          ctx.bag.delete(BAG_BUFFER);
          if (!text) return [];
          return [{ op: "send", text }];
        }
        case "answer_open":
        case "answer_commit":
          return [];
        default:
          return [];
      }
    },
    async dispose(ctx: StrategyContext): Promise<void> {
      ctx.bag.delete(BAG_BUFFER);
    },
  };
}
