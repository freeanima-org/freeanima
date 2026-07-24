import { omitUndefined } from "@freeanima/host/core/util";
import type { StreamEvent } from "@freeanima/host/engine/loop";
import {
  createGatewayToolRoundStrategy,
  createStreamChannelComposer,
  createWeixinStreamingAnswerStrategy,
} from "../stream-strategies/index.ts";
import type { ToolDisplayMode } from "../tool-display.ts";
import { DEFAULT_TOOL_DISPLAY_MODE } from "../tool-display.ts";
import { runStreamChannel, type RunStreamChannelOptions } from "../stream-state/run-channel.ts";

const SEND_GAP_MS = 80;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
}

export type WeixinStreamDeps = {
  send: (text: string) => Promise<void>;
  refreshTyping?: () => Promise<void>;
};

export type WeixinStreamChannelOptions = RunStreamChannelOptions & {
  deps: WeixinStreamDeps;
  toolDisplayMode?: ToolDisplayMode;
};

export async function streamReplyToWeixin(
  events: AsyncIterable<StreamEvent>,
  deps: WeixinStreamDeps,
  opts?: Omit<WeixinStreamChannelOptions, "deps">,
): Promise<{ answerSent: boolean; progressSent: boolean }> {
  let answerSent = false;
  let progressSent = false;

  const typingTimer =
    deps.refreshTyping &&
    setInterval(() => {
      void deps.refreshTyping?.();
    }, 25_000);
  if (deps.refreshTyping) void deps.refreshTyping();

  const io = {
    send: async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;
      progressSent = true;
      await deps.send(trimmed);
      await sleep(SEND_GAP_MS);
    },
  };

  const toolDisplayMode = opts?.toolDisplayMode ?? DEFAULT_TOOL_DISPLAY_MODE;
  const toolStrategy = createGatewayToolRoundStrategy(io.send.bind(io), toolDisplayMode);
  const toolHandle = toolStrategy.handle.bind(toolStrategy);
  toolStrategy.handle = async (effect, ctx) => {
    if (effect.kind === "tool_round" || effect.kind === "clarify") progressSent = true;
    return toolHandle(effect, ctx);
  };

  const answerStrategy = createWeixinStreamingAnswerStrategy({
    io: {
      send: async (text: string) => {
        await io.send(text);
        answerSent = true;
      },
    },
  });

  const composer = createStreamChannelComposer({
    strategies: [toolStrategy, answerStrategy],
    io: {},
    ...omitUndefined({ signal: opts?.signal }),
  });

  try {
    await runStreamChannel(events, composer, {
      ...opts,
      platform: "weixin",
      toolDisplayMode,
    });
  } finally {
    if (typingTimer) clearInterval(typingTimer);
  }

  return { answerSent, progressSent };
}
