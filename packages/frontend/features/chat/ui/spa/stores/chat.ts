import { omitUndefined } from "@freeanima/shared/util";
import type {
  LlmDebugSnapshotPayload,
  StreamApiEvent,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { pollUntilAssistantReply } from "@freeanima/features/chat/ui/spa/lib/display-recovery.ts";
import { randomUuid } from "@freeanima/shared/rpc-contract";
import { subscribeHabitatRpcConnectionState } from "@freeanima/shared/habitat-rpc/bundled-browser.ts";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";
import { create } from "zustand";
import {
  interruptMessageStream,
  lookupActiveStream,
  resumeMessageStream,
  subscribeContinueStream,
  subscribeMessageStream,
  subscribeConversationUpdates,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import {
  clearPersistedActiveStream,
  readPersistedActiveStream,
  writePersistedActiveStream,
} from "@freeanima/features/chat/ui/spa/lib/active-stream-persist.ts";
import {
  handleStreamEvent,
  type StreamEventCallbacks,
} from "@freeanima/features/chat/ui/spa/lib/stream-events.ts";

type SendDoneOptions = {
  recovered?: boolean;
};

export type SendCallbacks = StreamEventCallbacks & {
  onRecovering?: (active: boolean) => void;
  onError?: (msg: string) => void;
  onDone?: (opts?: SendDoneOptions) => void;
  recoverDisplay?: (conversationId: string) => Promise<boolean>;
};

export type { LlmDebugSnapshotPayload };

export type QueuedMessage = {
  id: string;
  conversationId: string;
  text: string;
};

type ChatState = {
  streaming: boolean;
  recovering: boolean;
  recoveringConversationId: string | null;
  streamingConversationId: string | null;
  /** 用户点过停止的会话；禁止 lookup/resume 把流接回来，直到再次发送或【继续】 */
  userStoppedIds: string[];
  streamText: string;
  queue: QueuedMessage[];
  renderMd: (text: string) => string;
  enqueue: (conversationId: string, text: string) => void;
  takeQueued: (id: string) => QueuedMessage | null;
  removeQueued: (id: string) => void;
  peekQueue: (conversationId: string) => QueuedMessage | null;
  wasUserStopped: (conversationId: string) => boolean;
  clearUserStopped: (conversationId: string) => void;
  setRecovering: (conversationId: string, active: boolean) => void;
  stop: (conversationId: string) => Promise<void>;
  send: (
    conversationId: string,
    text: string,
    callbacks?: SendCallbacks,
    opts?: {
      llmDebug?: boolean;
      clientOpId?: string;
      expectedTailPos?: number;
      forceTail?: boolean;
      attachmentTempIds?: string[];
      attachments?: Array<{ filename: string; mime_type: string; size: number }>;
      onStreamDone?: () => void;
      onTailConflict?: () => void;
    },
  ) => Promise<void>;
  /** 刷新后按 conversation 续接服务端仍在进行的流；成功返回 true */
  resumeIfActive: (conversationId: string, callbacks?: SendCallbacks) => Promise<boolean>;
  /** stalled【继续】：从当前消息链续跑（不 rollback） */
  continueTurn: (
    conversationId: string,
    callbacks?: SendCallbacks,
    opts?: { llmDebug?: boolean },
  ) => Promise<void>;
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

function renderMd(text: string): string {
  return renderMarkdownHtml(text);
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

    const sub = subscribeConversationUpdates(conversationId, () => {
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

function withoutId(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

export const useChatStore = create<ChatState>((set, get) => ({
  streaming: false,
  recovering: false,
  recoveringConversationId: null,
  streamingConversationId: null,
  userStoppedIds: [],
  streamText: "",
  queue: [],
  renderMd,

  wasUserStopped(conversationId) {
    return get().userStoppedIds.includes(conversationId);
  },

  clearUserStopped(conversationId) {
    set((s) => ({ userStoppedIds: withoutId(s.userStoppedIds, conversationId) }));
  },

  setRecovering(conversationId, active) {
    if (active) {
      set({ recovering: true, recoveringConversationId: conversationId });
      return;
    }
    const cur = get();
    if (cur.recoveringConversationId && cur.recoveringConversationId !== conversationId) {
      return;
    }
    set({ recovering: false, recoveringConversationId: null });
  },

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
      recoveringConversationId: null,
      streamingConversationId: null,
      streamText: "",
    });
  },

  async stop(conversationId) {
    clearPersistedActiveStream(conversationId);
    set((s) => ({
      userStoppedIds: s.userStoppedIds.includes(conversationId)
        ? s.userStoppedIds
        : [...s.userStoppedIds, conversationId],
    }));
    get().abortStream();
    void interruptMessageStream(conversationId).catch((e) => {
      console.error("interrupt failed:", e);
    });
  },

  async send(conversationId, text, callbacks = {}, sendOpts = {}) {
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
      recoveringConversationId: null,
      streamingConversationId: conversationId,
      streamText: "",
      userStoppedIds: withoutId(get().userStoppedIds, conversationId),
    });

    let streamText = "";
    let receivedDone = false;
    let receivedError = false;
    let tailConflict = false;
    let serverErrorMsg: string | null = null;
    let transportErrorMsg: string | null = null;
    let doneNotified = false;

    const notifyDone = (doneOpts?: SendDoneOptions) => {
      if (doneNotified) return;
      doneNotified = true;
      receivedDone = true;
      callbacks.onDone?.(doneOpts);
    };

    const finishWithRecovery = async (fallbackError?: string) => {
      if (receivedDone) return;
      const recovered = await tryRecoverDisplay(
        conversationId,
        callbacks.recoverDisplay,
        (active) => {
          get().setRecovering(conversationId, active);
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
        callbacks.onError?.("无回复，请检查 API 密钥与服务端日志");
      }
    };

    try {
      let connOff: (() => void) | null = null;
      await new Promise<void>((resolve, reject) => {
        let activeStreamId: string | null = null;
        let hadDisconnect = false;
        let settling = false;

        const settleOk = () => {
          if (settling) return;
          settling = true;
          connOff?.();
          connOff = null;
          resolve();
        };
        const settleErr = (err: Error) => {
          if (settling) return;
          settling = true;
          connOff?.();
          connOff = null;
          reject(err);
        };

        const attachStreamHandlers = (mode: "send" | "resume") => {
          const onData = (ev: StreamApiEvent) => {
            if (generation !== _streamGeneration) return;
            if (ev.event === "error" && ev.data.code === "tail_conflict") {
              tailConflict = true;
              receivedError = true;
              sendOpts.onTailConflict?.();
              settleOk();
              return;
            }
            const result = handleStreamEvent(ev, streamText, callbacks, (partial) => set(partial));
            streamText = result.streamText;
            if (result.receivedError) {
              receivedError = true;
              if (ev.event === "error") {
                serverErrorMsg = ev.data.error || "服务端错误";
              }
            }
            if (result.receivedDone) {
              sendOpts.onStreamDone?.();
              // error 后再发 done（bridge 惯例）：不当成功，留给下方 onError
              if (!receivedError) {
                notifyDone();
              }
              settleOk();
            }
          };

          const onError = (err: Error) => {
            if (generation !== _streamGeneration) {
              // 与 onComplete 相同：abort 后必须 settle，否则 await send 挂死、sendingRef 卡死
              settleOk();
              return;
            }
            // 传输层断开：等重连 attach，不立刻失败
            if (activeStreamId && !receivedDone) {
              hadDisconnect = true;
              return;
            }
            receivedError = true;
            transportErrorMsg = err.message || "服务端错误";
            settleErr(err);
          };

          const onComplete = () => {
            // abortStream 会先 ++generation 再 unsubscribe→onComplete；必须 settle，否则 Promise 挂死
            if (generation !== _streamGeneration) {
              settleOk();
              return;
            }
            if (!receivedDone && activeStreamId && hadDisconnect) return;
            settleOk();
          };

          const onStreamId = (streamId: string) => {
            if (generation !== _streamGeneration) return;
            activeStreamId = streamId;
            writePersistedActiveStream(conversationId, streamId);
          };

          if (mode === "resume" && activeStreamId) {
            return resumeMessageStream(activeStreamId, {
              onData,
              onError,
              onComplete,
              onStreamId,
            });
          }
          return subscribeMessageStream(
            omitUndefined({
              conversationId,
              message: text,
              llmDebug: sendOpts.llmDebug,
              clientOpId: sendOpts.clientOpId,
              expectedTailPos: sendOpts.expectedTailPos,
              forceTail: sendOpts.forceTail,
              attachmentTempIds: sendOpts.attachmentTempIds,
              attachments: sendOpts.attachments,
            }),
            { onData, onError, onComplete, onStreamId },
          );
        };

        connOff = subscribeHabitatRpcConnectionState((state) => {
          if (generation !== _streamGeneration || settling) return;
          if (state === "disconnected" && activeStreamId && !receivedDone) {
            hadDisconnect = true;
            return;
          }
          if (state === "connected" && hadDisconnect && activeStreamId && !receivedDone) {
            // 先拆旧订阅（hadDisconnect 仍为 true → onComplete 不 settle），再清标志并 resume
            if (_unsubscribe) {
              _unsubscribe();
              _unsubscribe = null;
            }
            hadDisconnect = false;
            const next = attachStreamHandlers("resume");
            _unsubscribe = () => next.unsubscribe();
          }
        });

        const sub = attachStreamHandlers("send");
        _unsubscribe = () => sub.unsubscribe();
      });

      if (generation !== _streamGeneration) return;

      if (tailConflict) {
        set({
          streaming: false,
          recovering: false,
          recoveringConversationId: null,
          streamingConversationId: null,
          streamText: "",
        });
        return;
      }

      if (serverErrorMsg) {
        // 对齐 resumeIfActive：有服务端 error 时直接 onError（勿走 finishWithRecovery，
        // 因其在 receivedDone 时会 early-return，吞掉 onError）
        callbacks.onError?.(serverErrorMsg);
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
          get().setRecovering(conversationId, active);
          callbacks.onRecovering?.(active);
        },
      );
      if (recovered) {
        notifyDone({ recovered: true });
      } else if (!receivedError || transportErrorMsg) {
        callbacks.onError?.(transportErrorMsg || "网络错误");
      }
    } finally {
      if (generation === _streamGeneration) {
        if (receivedDone || receivedError || tailConflict) {
          clearPersistedActiveStream(conversationId);
        }
        const active = get();
        if (active.streamingConversationId === conversationId) {
          set({
            streaming: false,
            recovering: false,
            recoveringConversationId: null,
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

  async resumeIfActive(conversationId, callbacks = {}) {
    if (get().wasUserStopped(conversationId)) return false;
    if (get().streaming && get().streamingConversationId === conversationId) {
      return true;
    }

    let streamId: string | null = null;
    try {
      const looked = await lookupActiveStream(conversationId);
      if (typeof looked.stream_id === "string" && looked.stream_id) {
        streamId = looked.stream_id;
      }
    } catch (e) {
      console.error("stream.lookup failed:", e);
    }
    if (!streamId) {
      streamId = readPersistedActiveStream(conversationId)?.streamId ?? null;
    }
    if (!streamId) return false;

    const generation = ++_streamGeneration;
    writePersistedActiveStream(conversationId, streamId);
    set({
      streaming: true,
      recovering: true,
      recoveringConversationId: conversationId,
      streamingConversationId: conversationId,
      streamText: "",
    });

    let streamText = "";
    let receivedDone = false;
    let receivedError = false;
    let serverErrorMsg: string | null = null;
    let transportErrorMsg: string | null = null;
    let doneNotified = false;
    let aborted = false;

    const notifyDone = (doneOpts?: SendDoneOptions) => {
      if (doneNotified) return;
      doneNotified = true;
      receivedDone = true;
      callbacks.onDone?.(doneOpts);
    };

    try {
      let connOff: (() => void) | null = null;
      await new Promise<void>((resolve, reject) => {
        let activeStreamId: string | null = streamId;
        let hadDisconnect = false;
        let settling = false;

        const settleOk = () => {
          if (settling) return;
          settling = true;
          connOff?.();
          connOff = null;
          resolve();
        };
        const settleErr = (err: Error) => {
          if (settling) return;
          settling = true;
          connOff?.();
          connOff = null;
          reject(err);
        };

        const readSnapshot = () => {
          const onData = (ev: StreamApiEvent) => {
            if (generation !== _streamGeneration) return;
            const result = handleStreamEvent(ev, streamText, callbacks, (partial) => {
              set({ ...partial, recovering: false, recoveringConversationId: null });
            });
            streamText = result.streamText;
            if (result.receivedError) {
              receivedError = true;
              if (ev.event === "error") {
                serverErrorMsg = ev.data.error || "服务端错误";
              }
            }
            if (result.receivedDone) {
              // error 后再发 done（bridge 惯例）：不当成功，留给下方 onError（对齐 send）
              if (!receivedError) {
                notifyDone();
              }
              settleOk();
            }
          };
          const onError = (err: Error) => {
            if (generation !== _streamGeneration) {
              aborted = true;
              settleOk();
              return;
            }
            // attach 失败等：不要当成可静默重连的传输断开
            receivedError = true;
            transportErrorMsg = err.message || "服务端错误";
            settleErr(err);
          };
          const onComplete = () => {
            // abortStream 会 unsubscribe→finish→onComplete；必须 settle，否则 Promise 挂死
            if (generation !== _streamGeneration) {
              aborted = true;
              settleOk();
              return;
            }
            if (!receivedDone && activeStreamId && hadDisconnect) return;
            settleOk();
          };
          const resumeId = streamId;
          if (!resumeId) {
            settleErr(new Error("missing stream_id"));
            return { unsubscribe: () => {} };
          }
          return resumeMessageStream(resumeId, {
            onData,
            onError,
            onComplete,
            onStreamId: (id) => {
              activeStreamId = id;
              writePersistedActiveStream(conversationId, id);
            },
          });
        };

        connOff = subscribeHabitatRpcConnectionState((state) => {
          if (generation !== _streamGeneration || settling) return;
          if (state === "disconnected" && activeStreamId && !receivedDone) {
            hadDisconnect = true;
            return;
          }
          if (state === "connected" && hadDisconnect && activeStreamId && !receivedDone) {
            // 先拆旧订阅（hadDisconnect 仍为 true → onComplete 不 settle），再清标志并 resume
            if (_unsubscribe) {
              _unsubscribe();
              _unsubscribe = null;
            }
            hadDisconnect = false;
            const next = readSnapshot();
            _unsubscribe = () => next.unsubscribe();
          }
        });

        const sub = readSnapshot();
        _unsubscribe = () => sub.unsubscribe();
      });

      if (generation !== _streamGeneration || aborted) return false;

      if (serverErrorMsg) {
        clearPersistedActiveStream(conversationId);
        callbacks.onError?.(serverErrorMsg);
        return false;
      }
      if (!doneNotified) {
        const recovered = await tryRecoverDisplay(
          conversationId,
          callbacks.recoverDisplay,
          (active) => {
            get().setRecovering(conversationId, active);
            callbacks.onRecovering?.(active);
          },
        );
        if (recovered) {
          notifyDone({ recovered: true });
          return true;
        }
        return false;
      }
      return true;
    } catch (e) {
      if (generation !== _streamGeneration || aborted) return false;
      console.error("resumeIfActive error:", e);
      // sessionStorage 可能过期（Habitat 重启后）：清掉，勿长时间轮询假装还在生成
      clearPersistedActiveStream(conversationId);
      const errMsg = e instanceof Error ? e.message : String(e);
      const streamGone = /stream not found|not found/i.test(errMsg);
      if (!streamGone) {
        const recovered = await tryRecoverDisplay(
          conversationId,
          callbacks.recoverDisplay,
          (active) => {
            get().setRecovering(conversationId, active);
            callbacks.onRecovering?.(active);
          },
        );
        if (recovered) {
          notifyDone({ recovered: true });
          return true;
        }
      }
      if (transportErrorMsg) callbacks.onError?.(transportErrorMsg);
      return false;
    } finally {
      if (generation === _streamGeneration) {
        if (receivedDone || receivedError) {
          clearPersistedActiveStream(conversationId);
        }
        const active = get();
        if (active.streamingConversationId === conversationId) {
          set({
            streaming: false,
            recovering: false,
            recoveringConversationId: null,
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

  async continueTurn(conversationId, callbacks = {}, opts = {}) {
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
      recoveringConversationId: null,
      streamingConversationId: conversationId,
      streamText: "",
      userStoppedIds: withoutId(get().userStoppedIds, conversationId),
    });

    let streamText = "";
    let receivedDone = false;
    let receivedError = false;
    let serverErrorMsg: string | null = null;
    let transportErrorMsg: string | null = null;
    let doneNotified = false;

    const notifyDone = (doneOpts?: SendDoneOptions) => {
      if (doneNotified) return;
      doneNotified = true;
      receivedDone = true;
      callbacks.onDone?.(doneOpts);
    };

    try {
      let connOff: (() => void) | null = null;
      await new Promise<void>((resolve, reject) => {
        let activeStreamId: string | null = null;
        let hadDisconnect = false;
        let settling = false;

        const settleOk = () => {
          if (settling) return;
          settling = true;
          connOff?.();
          connOff = null;
          resolve();
        };
        const settleErr = (err: Error) => {
          if (settling) return;
          settling = true;
          connOff?.();
          connOff = null;
          reject(err);
        };

        const attachStreamHandlers = (mode: "continue" | "resume") => {
          const onData = (ev: StreamApiEvent) => {
            if (generation !== _streamGeneration) return;
            const result = handleStreamEvent(ev, streamText, callbacks, (partial) => set(partial));
            streamText = result.streamText;
            if (result.receivedError) {
              receivedError = true;
              if (ev.event === "error") {
                serverErrorMsg = ev.data.error || "服务端错误";
              }
            }
            if (result.receivedDone) {
              if (!receivedError) {
                notifyDone();
              }
              settleOk();
            }
          };

          const onError = (err: Error) => {
            if (generation !== _streamGeneration) {
              settleOk();
              return;
            }
            if (activeStreamId && !receivedDone) {
              hadDisconnect = true;
              return;
            }
            receivedError = true;
            transportErrorMsg = err.message || "服务端错误";
            settleErr(err);
          };

          const onComplete = () => {
            if (generation !== _streamGeneration) {
              settleOk();
              return;
            }
            if (!receivedDone && activeStreamId && hadDisconnect) return;
            settleOk();
          };

          const onStreamId = (streamId: string) => {
            if (generation !== _streamGeneration) return;
            activeStreamId = streamId;
            writePersistedActiveStream(conversationId, streamId);
          };

          if (mode === "resume" && activeStreamId) {
            return resumeMessageStream(activeStreamId, {
              onData,
              onError,
              onComplete,
              onStreamId,
            });
          }
          return subscribeContinueStream(
            omitUndefined({
              conversationId,
              llmDebug: opts.llmDebug,
            }),
            { onData, onError, onComplete, onStreamId },
          );
        };

        connOff = subscribeHabitatRpcConnectionState((state) => {
          if (generation !== _streamGeneration || settling) return;
          if (state === "disconnected" && activeStreamId && !receivedDone) {
            hadDisconnect = true;
            return;
          }
          if (state === "connected" && hadDisconnect && activeStreamId && !receivedDone) {
            if (_unsubscribe) {
              _unsubscribe();
              _unsubscribe = null;
            }
            hadDisconnect = false;
            const next = attachStreamHandlers("resume");
            _unsubscribe = () => next.unsubscribe();
          }
        });

        const sub = attachStreamHandlers("continue");
        _unsubscribe = () => sub.unsubscribe();
      });

      if (generation !== _streamGeneration) return;

      if (serverErrorMsg) {
        callbacks.onError?.(serverErrorMsg);
      } else if (!doneNotified) {
        const recovered = await tryRecoverDisplay(
          conversationId,
          callbacks.recoverDisplay,
          (active) => {
            get().setRecovering(conversationId, active);
            callbacks.onRecovering?.(active);
          },
        );
        if (recovered) {
          notifyDone({ recovered: true });
        } else if (!streamText.trim()) {
          callbacks.onError?.("无回复，请检查 API 密钥与服务端日志");
        }
      }
    } catch (e) {
      if (generation !== _streamGeneration) return;
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("continueTurn error:", e);
      callbacks.onError?.(transportErrorMsg || "网络错误");
    } finally {
      if (generation === _streamGeneration) {
        if (receivedDone || receivedError) {
          clearPersistedActiveStream(conversationId);
        }
        const active = get();
        if (active.streamingConversationId === conversationId) {
          set({
            streaming: false,
            recovering: false,
            recoveringConversationId: null,
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
