import type { StreamApiEvent } from "@freeanima/platform/connectors/webui/api";
import { pollUntilAssistantReply } from "@freeanima/platform/connectors/webui/display-recovery";
import { marked } from "marked";
import { create } from "zustand";
import { m } from "@/lib/i18n.ts";
import { subscribeMessageStream, subscribeSessionEvents } from "@/lib/api.ts";

type SendDoneOptions = {
  recovered?: boolean;
};

type SendCallbacks = {
  onToken?: (text: string) => void;
  onToolBegin?: (data: Record<string, unknown>) => void;
  onToolResult?: (data: Record<string, unknown>) => void;
  onToolError?: (data: Record<string, unknown>) => void;
  onAwaitingClarify?: (data: Record<string, unknown>) => void;
  onRecovering?: (active: boolean) => void;
  onError?: (msg: string) => void;
  onDone?: (opts?: SendDoneOptions) => void;
  recoverDisplay?: (sessionId: string) => Promise<boolean>;
};

type ChatState = {
  streaming: boolean;
  recovering: boolean;
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
    case "accepted":
      useChatStore.setState({ streaming: true });
      break;
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
    case "interrupted":
      receivedDone = true;
      break;
    case "error":
      receivedError = true;
      break;
    case "done":
      receivedDone = true;
      break;
    case "ping":
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

async function waitForAssistantViaSessionEvents(
  sessionId: string,
  recoverDisplay: (sessionId: string) => Promise<boolean>,
  maxDurationMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const deadline = Date.now() + maxDurationMs;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      sub.unsubscribe();
      if (pollTimer !== null) clearTimeout(pollTimer);
      resolve(ok);
    };

    const tryRefresh = async (): Promise<boolean> => {
      if (await recoverDisplay(sessionId)) {
        finish(true);
        return true;
      }
      return false;
    };

    const sub = subscribeSessionEvents(sessionId, () => {
      void tryRefresh();
    });

    const schedulePoll = () => {
      if (settled) return;
      if (Date.now() >= deadline) {
        finish(false);
        return;
      }
      pollTimer = setTimeout(async () => {
        await tryRefresh();
        schedulePoll();
      }, 2_000);
    };

    void (async () => {
      if (await tryRefresh()) return;
      schedulePoll();
      setTimeout(() => finish(false), maxDurationMs);
    })();
  });
}

async function tryRecoverDisplay(
  sessionId: string,
  recoverDisplay?: (sessionId: string) => Promise<boolean>,
  onRecovering?: (active: boolean) => void,
): Promise<boolean> {
  if (!recoverDisplay) return false;
  onRecovering?.(true);
  try {
    if (await pollUntilAssistantReply(sessionId, recoverDisplay)) return true;
    return await waitForAssistantViaSessionEvents(sessionId, recoverDisplay, 60_000);
  } finally {
    onRecovering?.(false);
  }
}

export const useChatStore = create<ChatState>(() => ({
  streaming: false,
  recovering: false,
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
      recovering: false,
      streamingSessionId: null,
    });
  },

  async send(sessionId, text, callbacks = {}) {
    useChatStore.getState().abortStream();

    useChatStore.setState({
      streaming: true,
      recovering: false,
      streamingSessionId: sessionId,
      streamText: "",
    });

    let streamText = "";
    let receivedDone = false;
    let receivedError = false;
    let serverErrorMsg: string | null = null;
    let transportErrorMsg: string | null = null;
    let doneNotified = false;

    const notifyDone = (opts?: SendDoneOptions) => {
      if (doneNotified) return;
      doneNotified = true;
      receivedDone = true;
      callbacks.onDone?.(opts);
    };

    const finishWithRecovery = async (fallbackError?: string) => {
      if (receivedDone) return;
      const recovered = await tryRecoverDisplay(sessionId, callbacks.recoverDisplay, (active) => {
        useChatStore.setState({ recovering: active });
        callbacks.onRecovering?.(active);
      });
      if (recovered) {
        notifyDone({ recovered: true });
        return;
      }
      if (fallbackError) {
        callbacks.onError?.(fallbackError);
      } else if (!streamText.trim()) {
        callbacks.onError?.(m.webui_common_no_reply());
      }
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const sub = subscribeMessageStream(
          { sessionId, message: text },
          {
            onData: (ev) => {
              const result = handleStreamEvent(ev, streamText, callbacks);
              streamText = result.streamText;
              if (result.receivedError) {
                receivedError = true;
                if (ev.event === "error") {
                  serverErrorMsg = ev.data.error || m.webui_common_server_error();
                }
              }
              if (result.receivedDone) notifyDone();
            },
            onError: (err) => {
              receivedError = true;
              transportErrorMsg = err.message || m.webui_common_server_error();
              reject(err);
            },
            onComplete: () => {
              resolve();
            },
          },
        );
        _unsubscribe = () => sub.unsubscribe();
      });

      if (serverErrorMsg) {
        await finishWithRecovery(serverErrorMsg);
      } else if (!doneNotified) {
        await finishWithRecovery();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("send error:", e);
      const recovered = await tryRecoverDisplay(sessionId, callbacks.recoverDisplay, (active) => {
        useChatStore.setState({ recovering: active });
        callbacks.onRecovering?.(active);
      });
      if (recovered) {
        notifyDone({ recovered: true });
      } else if (!receivedError || transportErrorMsg) {
        callbacks.onError?.(transportErrorMsg || m.webui_common_network_error());
      }
    } finally {
      useChatStore.setState({
        streaming: false,
        recovering: false,
        streamingSessionId: null,
      });
      _unsubscribe = null;
    }
  },
}));
