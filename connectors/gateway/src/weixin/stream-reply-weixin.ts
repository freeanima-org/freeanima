import type { StreamEvent } from "@freeanima/engine-loop";
import { formatClarifyForPlatform, parseClarifyStreamEvent } from "../clarify/index.ts";
import { ToolRoundCollector } from "../stream-tool-format.ts";

export type WeixinStreamDeps = {
  /** Send one visible message (short progress or final body; caller handles chunking) */
  send: (text: string) => Promise<void>;
  /** Refresh typing indicator during long phases (optional) */
  refreshTyping?: () => Promise<void>;
};

const TYPING_REFRESH_MS = 25_000;
const SEND_GAP_MS = 80;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * WeChat outbound streaming: each tool round merged into one message, assistant body sent after stream ends.
 * WeChat has no message edit API; structure aligned with Discord but simulated via multiple sends.
 */
export async function streamReplyToWeixin(
  events: AsyncIterable<StreamEvent>,
  deps: WeixinStreamDeps,
): Promise<{ answerSent: boolean; progressSent: boolean }> {
  const toolRound = new ToolRoundCollector();
  let answerBuffer = "";
  let progressSent = false;
  let typingTimer: ReturnType<typeof setInterval> | null = null;

  const stopTypingRefresh = (): void => {
    if (typingTimer !== null) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
  };

  const startTypingRefresh = (): void => {
    if (!deps.refreshTyping || typingTimer !== null) return;
    void deps.refreshTyping();
    typingTimer = setInterval(() => {
      void deps.refreshTyping?.();
    }, TYPING_REFRESH_MS);
  };

  const sendProgress = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    progressSent = true;
    await deps.send(trimmed);
    await sleep(SEND_GAP_MS);
  };

  const flushToolRound = async (): Promise<void> => {
    const text = toolRound.take();
    if (text) await sendProgress(text);
  };

  startTypingRefresh();

  try {
    for await (const event of events) {
      switch (event.event) {
        case "token":
          await flushToolRound();
          answerBuffer += event.data.content;
          break;
        case "content_replace":
          await flushToolRound();
          answerBuffer = event.data.content;
          break;
        case "awaiting_clarify": {
          await flushToolRound();
          const payload = parseClarifyStreamEvent(event.data);
          if (payload) {
            await sendProgress(formatClarifyForPlatform("weixin", payload));
          }
          break;
        }
        case "tool_begin":
          answerBuffer = "";
          toolRound.addBegin(event.data.name, event.data.args);
          break;
        case "tool_result":
          toolRound.addResult(event.data.name, event.data.content);
          break;
        case "tool_error":
          toolRound.addError(event.data.content);
          break;
        case "error":
          throw new Error(event.data.error);
        case "interrupted":
          throw new Error(event.data.reason);
        case "done":
          break;
      }
    }
  } finally {
    stopTypingRefresh();
  }

  await flushToolRound();

  const trimmedAnswer = answerBuffer.trim();
  let answerSent = false;
  if (trimmedAnswer) {
    await deps.send(trimmedAnswer);
    answerSent = true;
  }

  return { answerSent, progressSent };
}
