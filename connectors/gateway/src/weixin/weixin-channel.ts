import type { StreamEvent } from "@freeanima/engine-loop";
import {
  createStreamChannelComposer,
  createToolRoundStrategy,
  createWeixinBufferedAnswerStrategy,
} from "../stream-strategies/index.ts";
import { runStreamChannel, type RunStreamChannelOptions } from "../stream-state/run-channel.ts";

const SEND_GAP_MS = 80;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type WeixinStreamDeps = {
  send: (text: string) => Promise<void>;
  refreshTyping?: () => Promise<void>;
};

export type WeixinStreamChannelOptions = RunStreamChannelOptions & {
  deps: WeixinStreamDeps;
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

  const toolStrategy = createToolRoundStrategy();
  const toolHandle = toolStrategy.handle.bind(toolStrategy);
  toolStrategy.handle = async (effect, ctx) => {
    const actions = await toolHandle(effect, ctx);
    for (const action of actions) {
      if (action.op === "send") await io.send(action.text);
    }
    return [];
  };

  const answerStrategy = createWeixinBufferedAnswerStrategy();
  const answerHandle = answerStrategy.handle.bind(answerStrategy);
  answerStrategy.handle = async (effect, ctx) => {
    const actions = await answerHandle(effect, ctx);
    for (const action of actions) {
      if (action.op === "send") {
        await io.send(action.text);
        answerSent = true;
      }
    }
    return [];
  };

  const composer = createStreamChannelComposer({
    strategies: [toolStrategy, answerStrategy],
    io: {},
    signal: opts?.signal,
  });

  try {
    await runStreamChannel(events, composer, { ...opts, platform: "weixin" });
  } finally {
    if (typingTimer) clearInterval(typingTimer);
  }

  return { answerSent, progressSent };
}
