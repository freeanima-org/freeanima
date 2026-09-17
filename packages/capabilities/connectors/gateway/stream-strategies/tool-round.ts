import type { StreamEffect } from "../stream-state/types.ts";
import type { ChannelAction, StreamStrategy, StrategyContext } from "./types.ts";

/** 工具轮次与 clarify：透传为 send */
export function createToolRoundStrategy(): StreamStrategy {
  return {
    name: "tool-round",
    handle(effect: StreamEffect): ChannelAction[] {
      if (effect.kind === "tool_round" || effect.kind === "clarify") {
        return [{ op: "send", text: effect.text }];
      }
      return [];
    },
  };
}

export function createPassthroughEmitStrategy(): StreamStrategy {
  return {
    name: "passthrough-emit",
    handle(effect: StreamEffect): ChannelAction[] {
      switch (effect.kind) {
        case "tool_round":
          return [];
        case "clarify":
          return [{ op: "emit", event: "awaiting_clarify", data: { text: effect.text } }];
        case "answer_delta":
          return [{ op: "emit", event: "token", data: { content: effect.delta } }];
        case "answer_replace":
          return [{ op: "emit", event: "content_replace", data: { content: effect.content } }];
        case "turn_end":
          if (effect.reason === "error") {
            return [{ op: "emit", event: "error", data: { error: effect.message ?? "" } }];
          }
          if (effect.reason === "interrupted") {
            return [
              { op: "emit", event: "interrupted", data: { reason: effect.message ?? "" } },
              { op: "emit", event: "done", data: { reason: "interrupted" } },
            ];
          }
          return [{ op: "emit", event: "done", data: {} }];
        default:
          return [];
      }
    },
  };
}

export function createPassthroughToolEmitStrategy(): StreamStrategy {
  return {
    name: "passthrough-tool-emit",
    handle(effect: StreamEffect, _ctx: StrategyContext): ChannelAction[] {
      if (effect.kind !== "tool_round") return [];
      return [{ op: "noop" }];
    },
  };
}
