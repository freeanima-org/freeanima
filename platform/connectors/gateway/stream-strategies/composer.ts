import { omitUndefined } from "@freeanima/core/util";
import type { StreamEffect } from "../stream-state/types.ts";
import { chunkChannelActions } from "./chunk.ts";
import type { ChannelAction, ChannelIo, StreamStrategy, StrategyContext } from "./types.ts";

export type StreamChannelComposerOptions = {
  strategies: StreamStrategy[];
  io: ChannelIo;
  signal?: AbortSignal;
  chunk?: { limit?: number; maxChunkLength?: number };
};

export type StreamChannelComposer = {
  dispatch: (effect: StreamEffect, state: StrategyContext["state"]) => Promise<void>;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
};

export function createStreamChannelComposer(
  opts: StreamChannelComposerOptions,
): StreamChannelComposer {
  const ctx: StrategyContext = {
    state: {
      phase: "idle",
      visibleBlocks: [],
      segments: [],
      currentAnswer: "",
      activeSegmentId: null,
      nextSegmentId: 0,
      finalAnswer: null,
    },
    ...omitUndefined({ signal: opts.signal }),
    bag: new Map(),
  };

  const runActions = async (actions: ChannelAction[]): Promise<void> => {
    const chunked = chunkChannelActions(actions, opts.chunk);
    for (const action of chunked) {
      if (opts.signal?.aborted) return;
      switch (action.op) {
        case "send":
          await opts.io.send?.(action.text);
          break;
        case "edit":
          await opts.io.edit?.(action.text);
          break;
        case "emit":
          await opts.io.emit?.(action.event, action.data);
          break;
        case "noop":
          break;
      }
    }
  };

  return {
    async dispatch(effect, state) {
      ctx.state = state;
      if (opts.signal?.aborted) return;
      for (const strategy of opts.strategies) {
        const actions = await strategy.handle(effect, ctx);
        await runActions(actions);
      }
    },
    async flush() {
      for (const strategy of opts.strategies) {
        if (!strategy.flush) continue;
        const actions = await strategy.flush(ctx);
        await runActions(actions);
      }
    },
    async dispose() {
      for (const strategy of opts.strategies) {
        await strategy.dispose?.(ctx);
      }
    },
  };
}
