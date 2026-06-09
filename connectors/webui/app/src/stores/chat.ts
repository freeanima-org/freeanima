import type { StreamApiEvent } from "@freeanima/connectors-webui/api";
import { marked } from "marked";
import { create } from "zustand";
import { subscribeMessageStream } from "@/lib/api.ts";

type SendCallbacks = {
  onToken?: (text: string) => void;
  onToolBegin?: (data: Record<string, unknown>) => void;
  onToolResult?: (data: Record<string, unknown>) => void;
  onToolError?: (data: Record<string, unknown>) => void;
  onAwaitingClarify?: (data: Record<string, unknown>) => void;
  onError?: (msg: string) => void;
  onDone?: () => void;
};

type ChatState = {
  streaming: boolean;
  streamingSessionId: string | null;
  streamText: string;
  renderMd: (text: string) => string;
  send: (sessionId: string, text: string, callbacks?: SendCallbacks) => Promise<void>;
  abortStream: () => void;
};

let _unsubscribe: (() => void) | null = null;

function handleStreamEvent(
  ev: StreamApiEvent,
  streamText: string,
  callbacks: SendCallbacks,
): { streamText: string; receivedDone: boolean; receivedError: boolean } {
  let receivedDone = false;
  let receivedError = false;
  let nextText = streamText;

  switch (ev.event) {
    case "token":
      nextText += ev.data.content || "";
      useChatStore.setState({ streamText: nextText });
      callbacks.onToken?.(nextText);
      break;
    case "content_replace":
      nextText = ev.data.content || "";
      useChatStore.setState({ streamText: nextText });
      callbacks.onToken?.(nextText);
      break;
    case "tool_begin":
      callbacks.onToolBegin?.(ev.data as Record<string, unknown>);
      break;
    case "tool_result":
      callbacks.onToolResult?.(ev.data as Record<string, unknown>);
      break;
    case "awaiting_clarify":
      callbacks.onAwaitingClarify?.(ev.data as Record<string, unknown>);
      break;
    case "tool_error":
      callbacks.onToolError?.(ev.data as Record<string, unknown>);
      break;
    case "error":
      receivedError = true;
      callbacks.onError?.(ev.data.error || "服务端错误");
      break;
    case "done":
      receivedDone = true;
      callbacks.onDone?.();
      break;
  }

  return { streamText: nextText, receivedDone, receivedError };
}

function renderMd(text: string): string {
  if (!text) return "";
  try {
    return marked.parse(text, { breaks: true, gfm: true }) as string;
  } catch {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

export const useChatStore = create<ChatState>(() => ({
  streaming: false,
  streamingSessionId: null,
  streamText: "",
  renderMd,

  abortStream() {
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
    useChatStore.setState({
      streaming: false,
      streamingSessionId: null,
    });
  },

  async send(sessionId, text, callbacks = {}) {
    useChatStore.getState().abortStream();

    useChatStore.setState({
      streaming: true,
      streamingSessionId: sessionId,
      streamText: "",
    });

    let streamText = "";
    let receivedDone = false;
    let receivedError = false;
    let doneNotified = false;

    const notifyDone = () => {
      if (doneNotified) return;
      doneNotified = true;
      receivedDone = true;
      callbacks.onDone?.();
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const sub = subscribeMessageStream(
          { sessionId, message: text },
          {
            onData: (ev) => {
              const result = handleStreamEvent(ev, streamText, callbacks);
              streamText = result.streamText;
              if (result.receivedError) receivedError = true;
              if (result.receivedDone) notifyDone();
            },
            onError: (err) => {
              receivedError = true;
              callbacks.onError?.(err.message || "服务端错误");
              reject(err);
            },
            onComplete: () => {
              if (!receivedDone) {
                if (streamText.trim()) {
                  notifyDone();
                } else if (!receivedError) {
                  callbacks.onError?.("无回复，请检查 API 密钥与服务端日志");
                }
              }
              resolve();
            },
          },
        );
        _unsubscribe = () => sub.unsubscribe();
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("send error:", e);
      if (!receivedError) callbacks.onError?.("网络错误");
    } finally {
      useChatStore.setState({
        streaming: false,
        streamingSessionId: null,
      });
      _unsubscribe = null;
    }
  },
}));
