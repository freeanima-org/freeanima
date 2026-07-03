import type { DisplayItem, StreamApiEvent } from "@chat/lib/types.ts";
import { pollUntilAssistantReply } from "@chat/lib/display-recovery.ts";
import { randomUuid } from "@freeanima/sap-contract";
import { marked } from "marked";
import { create } from "zustand";
import { m } from "@chat/lib/i18n.ts";
import {
  interruptMessageStream,
  subscribeMessageStream,
  subscribeConversationEvents,
} from "@chat/lib/api.ts";

type SendDoneOptions = {
  recovered?: boolean;
};

export type SendCallbacks = {
  onToken?: (text: string) => void;
  onDisplayAppend?: (item: DisplayItem) => void;
  onAwaitingClarify?: (data: Record<string, unknown>) => void;
  onRecovering?: (active: boolean) => void;
  onError?: (msg: string) => void;
  onDone?: (opts?: SendDoneOptions) => void;
  recoverDisplay?: (conversationId: string) => Promise<boolean>;
};

export type QueuedMessage = {
  id: string;
  conversationId: string;
  text: string;
};

type ChatState = {
  streaming: boolean;
  recovering: boolean;
  streamingConversationId: string | null;
  streamText: string;
  queue: QueuedMessage[];
  renderMd: (text: string) => string;
  enqueue: (conversationId: string, text: string) => void;
  takeQueued: (id: string) => QueuedMessage | null;
  removeQueued: (id: string) => void;
  peekQueue: (conversationId: string) => QueuedMessage | null;
  stop: (conversationId: string) => Promise<void>;
  send: (conversationId: string, text: string, callbacks?: SendCallbacks) => Promise<void>;
  abortStream: () => void;
};

let _unsubscribe: (() => void) | null = null;
let _streamGeneration = 0;

function detachStreamClient(): void {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

function handleStreamEvent(
  ev: StreamApiEvent,
  streamText: string,
  callbacks: SendCallbacks,
  patch: (partial: Partial<Pick<ChatState, "streaming" | "streamText">>) => void,
): { streamText: string; receivedDone: boolean; receivedError: boolean } {
  let receivedDone = false;
  let receivedError = false;
  let nextText = streamText;

  switch (ev.event) {
    case "accepted":
      patch({ streaming: true });
      break;
    case "token":
      nextText += ev.data.content || "";
      patch({ streamText: nextText });
      callbacks.onToken?.(nextText);
      break;
    case "content_replace":
      nextText = ev.data.content || "";
      patch({ streamText: nextText });
      callbacks.onToken?.(nextText);
      break;
    case "display_append":
      if (ev.data.item.type === "message" && ev.data.item.role === "assistant") {
        nextText = "";
        patch({ streamText: "" });
        callbacks.onToken?.("");
      }
      callbacks.onDisplayAppend?.(ev.data.item);
      break;
    case "tool_begin":
    case "tool_result":
    case "tool_error":
      break;
    case "awaiting_clarify":
      callbacks.onAwaitingClarify?.(ev.data as Record<string, unknown>);
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
  conversationId: string,
  recoverDisplay: (conversationId: string) => Promise<boolean>,
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
      if (pollTimer != null) clearTimeout(pollTimer);
      resolve(ok);
    };

    const tryRefresh = async (): Promise<boolean> => {
      if (await recoverDisplay(conversationId)) {
        finish(true);
        return true;
      }
      return false;
    };

    const sub = subscribeConversationEvents(conversationId, () => {
      void tryRefresh();
    });

    const schedulePoll = () => {
      if (settled) return;
      if (Date.now() >= deadline) {
        finish(false);
        return;
      }
      pollTimer = setTimeout(() => {
        void (async () => {
          await tryRefresh();
          schedulePoll();
        })();
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
  conversationId: string,
  recoverDisplay?: (conversationId: string) => Promise<boolean>,
  onRecovering?: (active: boolean) => void,
): Promise<boolean> {
  if (!recoverDisplay) return false;
  onRecovering?.(true);
  try {
    if (await pollUntilAssistantReply(conversationId, recoverDisplay)) return true;
    return await waitForAssistantViaSessionEvents(conversationId, recoverDisplay, 60_000);
  } finally {
    onRecovering?.(false);
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  streaming: false,
  recovering: false,
  streamingConversationId: null,
  streamText: "",
  queue: [],
  renderMd,

  enqueue(conversationId, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const item: QueuedMessage = {
      id: randomUuid(),
      conversationId,
      text: trimmed,
    };
    set((s) => ({ queue: [...s.queue, item] }));
  },

  takeQueued(id) {
    let taken: QueuedMessage | null = null;
    set((s) => {
      const idx = s.queue.findIndex((q) => q.id === id);
      if (idx < 0) return s;
      const item = s.queue[idx];
      if (!item) return s;
      taken = item;
      return { queue: s.queue.filter((q) => q.id !== id) };
    });
    return taken;
  },

  removeQueued(id) {
    set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
  },

  peekQueue(conversationId) {
    return get().queue.find((q) => q.conversationId === conversationId) ?? null;
  },

  abortStream() {
    _streamGeneration++;
    detachStreamClient();
    set({
      streaming: false,
      recovering: false,
      streamingConversationId: null,
      streamText: "",
    });
  },

  async stop(conversationId) {
    try {
      await interruptMessageStream(conversationId);
    } catch (e) {
      console.error("interrupt failed:", e);
      get().abortStream();
    }
  },

  async send(conversationId, text, callbacks = {}) {
    const prev = get();
    if (prev.streaming && prev.streamingConversationId === conversationId) {
      detachStreamClient();
    } else if (prev.streaming) {
      _streamGeneration++;
      detachStreamClient();
      set({
        streaming: false,
        streamingConversationId: null,
        streamText: "",
      });
    }

    const generation = ++_streamGeneration;

    set({
      streaming: true,
      recovering: false,
      streamingConversationId: conversationId,
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
      const recovered = await tryRecoverDisplay(
        conversationId,
        callbacks.recoverDisplay,
        (active) => {
          set({ recovering: active });
          callbacks.onRecovering?.(active);
        },
      );
      if (recovered) {
        notifyDone({ recovered: true });
        return;
      }
      if (fallbackError) {
        callbacks.onError?.(fallbackError);
      } else if (!streamText.trim()) {
        callbacks.onError?.(m.console_common_no_reply());
      }
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const sub = subscribeMessageStream(
          { conversationId, message: text },
          {
            onData: (ev) => {
              if (generation !== _streamGeneration) return;
              const result = handleStreamEvent(ev, streamText, callbacks, (partial) =>
                set(partial),
              );
              streamText = result.streamText;
              if (result.receivedError) {
                receivedError = true;
                if (ev.event === "error") {
                  serverErrorMsg = ev.data.error || m.console_common_server_error();
                }
              }
              if (result.receivedDone) notifyDone();
            },
            onError: (err) => {
              if (generation !== _streamGeneration) return;
              receivedError = true;
              transportErrorMsg = err.message || m.console_common_server_error();
              reject(err);
            },
            onComplete: () => {
              if (generation !== _streamGeneration) return;
              resolve();
            },
          },
        );
        _unsubscribe = () => sub.unsubscribe();
      });

      if (generation !== _streamGeneration) return;

      if (serverErrorMsg) {
        await finishWithRecovery(serverErrorMsg);
      } else if (!doneNotified) {
        await finishWithRecovery();
      }
    } catch (e) {
      if (generation !== _streamGeneration) return;
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("send error:", e);
      const recovered = await tryRecoverDisplay(
        conversationId,
        callbacks.recoverDisplay,
        (active) => {
          set({ recovering: active });
          callbacks.onRecovering?.(active);
        },
      );
      if (recovered) {
        notifyDone({ recovered: true });
      } else if (!receivedError || transportErrorMsg) {
        callbacks.onError?.(transportErrorMsg || m.console_common_network_error());
      }
    } finally {
      if (generation === _streamGeneration) {
        const active = get();
        if (active.streamingConversationId === conversationId) {
          set({
            streaming: false,
            recovering: false,
            streamingConversationId: null,
            streamText: "",
          });
        }
        if (_unsubscribe) {
          _unsubscribe();
          _unsubscribe = null;
        }
      }
    }
  },
}));
