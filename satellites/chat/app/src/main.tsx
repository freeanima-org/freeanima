import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AcpProgressDock } from "@/components/AcpProgressDock.tsx";
import { FridgeMagnetInjectPreview } from "@/components/FridgeMagnetInjectPreview.tsx";
import { ToolBlockBubble } from "@/components/ToolBlockBubble.tsx";
import { useAcpProgressDock } from "@/hooks/useAcpProgressDock.ts";
import { formatSessionIdDateTime } from "@/lib/format-datetime.ts";
import { displayAwaitingReply, pollUntilAssistantReply } from "@/lib/display-recovery.ts";
import {
  getFridgeMagnets,
  listSessionCommands,
  loadConfig,
  subscribeSessionEvents,
} from "@/lib/api.ts";
import type { SapConnectionState } from "@freeanima/sap-contract";
import { getAppLocale, initAppLocale, m, toggleAppLocale } from "@/lib/i18n.ts";
import { loadInputDraft, saveInputDraft } from "@/lib/input-draft.ts";
import { getSapRelayClient, reconnectSap, subscribeSapConnection } from "@/lib/sap-client.ts";
import type { SessionListItem } from "@/lib/types.ts";
import { useChatStore } from "@/stores/chat.ts";
import { useSessionsStore } from "@/stores/sessions.ts";

initAppLocale();

type CommandItem = { name: string; description?: string };
type ClarifyPending = {
  items: Array<{ question: string; choices?: string[] }>;
  timeout_sec?: number;
};

function sessionLabel(item: SessionListItem) {
  return item.title || formatSessionIdDateTime(item.id);
}

function readSessionFromUrl(): string | undefined {
  const id = new URLSearchParams(window.location.search).get("session")?.trim();
  return id || undefined;
}

function writeSessionToUrl(sessionId: string | null) {
  const url = new URL(window.location.href);
  if (sessionId) url.searchParams.set("session", sessionId);
  else url.searchParams.delete("session");
  window.history.replaceState(null, "", url);
}

function App() {
  const sessions = useSessionsStore((s) => s.sessions);
  const currentId = useSessionsStore((s) => s.currentId);
  const display = useSessionsStore((s) => s.display);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);
  const selectSession = useSessionsStore((s) => s.selectSession);
  const newSessionFn = useSessionsStore((s) => s.newSession);
  const renameSession = useSessionsStore((s) => s.renameSession);
  const appendItem = useSessionsStore((s) => s.appendItem);
  const appendItemForSession = useSessionsStore((s) => s.appendItemForSession);
  const refreshMessages = useSessionsStore((s) => s.refreshMessages);
  const reloadSessionIfCurrent = useSessionsStore((s) => s.reloadSessionIfCurrent);
  const patchProgressLine = useSessionsStore((s) => s.patchProgressLine);

  const renderMd = useChatStore((s) => s.renderMd);
  const streaming = useChatStore((s) => s.streaming);
  const streamingSessionId = useChatStore((s) => s.streamingSessionId);
  const streamText = useChatStore((s) => s.streamText);
  const recovering = useChatStore((s) => s.recovering);
  const send = useChatStore((s) => s.send);
  const queue = useChatStore((s) => s.queue);
  const messageQueue = useMemo(
    () => (currentId ? queue.filter((q) => q.sessionId === currentId) : []),
    [currentId, queue],
  );

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sapConnection, setSapConnection] = useState<SapConnectionState>("connecting");
  const [locale, setLocale] = useState(getAppLocale());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    sessionId: null as string | null,
  });
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameText, setRenameText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const sendingRef = useRef(false);
  const msgAreaRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState(() => loadInputDraft(readSessionFromUrl() ?? null));
  const [commandList, setCommandList] = useState<CommandItem[]>([]);
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [clarifyPending, setClarifyPending] = useState<ClarifyPending | null>(null);
  const [fridgeData, setFridgeData] = useState({
    redis_configured: true,
    magnets: [] as Array<{ key: string; value: string }>,
    inject_text: "",
  });
  const [fridgeLoading, setFridgeLoading] = useState(false);
  const pendingRecoveryKeyRef = useRef<string | null>(null);

  const streamVisible = streaming && streamingSessionId === currentId;

  const acpDock = useAcpProgressDock(currentId, {
    patchProgress: patchProgressLine,
    onDecision: async (sid) => {
      const baseline = useSessionsStore.getState().display.length;
      await refreshMessages(sid, baseline);
    },
  });

  const INPUT_MAX_HEIGHT_PX = 192;

  const slashPrefix = useMemo(() => {
    if (!inputText.startsWith("/")) return null;
    const body = inputText.slice(1);
    if (body.includes(" ")) return null;
    return body.toLowerCase();
  }, [inputText]);

  const filteredCommands = useMemo(() => {
    if (slashPrefix === null) return [];
    return commandList.filter((c) => c.name.toLowerCase().startsWith(slashPrefix));
  }, [commandList, slashPrefix]);

  const showCmdMenu = filteredCommands.length > 0;

  const refreshFridgeMagnets = async () => {
    setFridgeLoading(true);
    try {
      setFridgeData(await getFridgeMagnets());
    } catch {
      setFridgeData({ redis_configured: false, magnets: [], inject_text: "" });
    } finally {
      setFridgeLoading(false);
    }
  };

  useEffect(() => {
    return subscribeSapConnection(setSapConnection);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadConfig();
        getSapRelayClient();
        setReady(true);

        const bootstrap = async () => {
          await getSapRelayClient().whenReady();
          const list = await fetchSessions();
          const fromUrl = readSessionFromUrl();
          if (fromUrl) {
            await selectSession(fromUrl);
          } else if (list.length > 0) {
            const id = list[0]!.id;
            await selectSession(id);
            writeSessionToUrl(id);
          }
          void listSessionCommands()
            .then((raw) => setCommandList((raw as { commands?: CommandItem[] }).commands ?? []))
            .catch((e) => console.error("commands:", e));
          void refreshFridgeMagnets();
        };

        void bootstrap().catch((e) => {
          console.error("chat bootstrap:", e);
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [fetchSessions, selectSession]);

  useEffect(() => {
    if (sapConnection !== "connected") return;
    void fetchSessions();
  }, [sapConnection, fetchSessions]);

  useEffect(() => {
    const close = () => setContextMenu((menu) => ({ ...menu, visible: false }));
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (!currentId) return;
    writeSessionToUrl(currentId);
    setInputText(loadInputDraft(currentId));
    requestAnimationFrame(() => {
      msgInputRef.current?.focus();
      resizeInput();
    });
  }, [currentId]);

  useEffect(() => {
    scrollDown();
  }, [currentId, display.length]);

  useEffect(() => {
    if (!currentId) return;
    const sub = subscribeSessionEvents(currentId, () => {
      void fetchSessions();
    });
    return () => sub.unsubscribe();
  }, [currentId, fetchSessions]);

  /** 刷新或切回会话时：末条为 user 且无 assistant → 轮询直到 Hub 落库 */
  useEffect(() => {
    if (!currentId) return;
    if (streaming && streamingSessionId === currentId) return;
    if (!displayAwaitingReply(display)) {
      pendingRecoveryKeyRef.current = null;
      return;
    }
    const key = `${currentId}@${display.length}`;
    if (pendingRecoveryKeyRef.current === key) return;
    pendingRecoveryKeyRef.current = key;

    const baseline = display.length;
    let cancelled = false;
    useChatStore.setState({ recovering: true });

    const sub = subscribeSessionEvents(currentId, () => {
      void refreshMessages(currentId, baseline);
    });

    void pollUntilAssistantReply(currentId, (id) => refreshMessages(id, baseline)).finally(() => {
      if (!cancelled) useChatStore.setState({ recovering: false });
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
      useChatStore.setState({ recovering: false });
    };
  }, [currentId, display, streaming, streamingSessionId, refreshMessages]);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = msgAreaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const resizeInput = () => {
    const el = msgInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`;
  };

  const applyCommand = (cmd: CommandItem) => {
    setInputText(`/${cmd.name} `);
    setSelectedCmdIdx(0);
    requestAnimationFrame(() => {
      resizeInput();
      msgInputRef.current?.focus();
    });
  };

  const navigateToSession = async (sessionId: string) => {
    if (sessionId === currentId) {
      setSidebarOpen(false);
      return;
    }
    setClarifyPending(null);
    await selectSession(sessionId);
    setSidebarOpen(false);
  };

  const newSession = async () => {
    const id = await newSessionFn();
    if (id) writeSessionToUrl(id);
  };

  const startRename = () => {
    const s = sessions.find((x) => x.id === contextMenu.sessionId);
    setRenameText((s && s.title) || "");
    setShowRenameDialog(true);
    setContextMenu((menu) => ({ ...menu, visible: false }));
    requestAnimationFrame(() => renameInputRef.current?.focus());
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && contextMenu.sessionId) {
      await renameSession(contextMenu.sessionId, title);
    }
    setShowRenameDialog(false);
    setRenameText("");
  };

  const flushQueueRef = useRef<(sessionId: string) => Promise<void>>(async () => {});

  const dispatchSend = useCallback(
    async (text: string, originSessionId: string) => {
      const displayBaseline = useSessionsStore.getState().display.length;
      if (clarifyPending) setClarifyPending(null);
      scrollDown();

      const isViewingOrigin = () => useSessionsStore.getState().currentId === originSessionId;

      await send(originSessionId, text, {
        recoverDisplay: (id) => refreshMessages(id, displayBaseline),
        onToken: () => {
          if (!isViewingOrigin()) return;
          scrollDown();
        },
        onDisplayAppend: (item) => {
          appendItemForSession(originSessionId, item);
          if (isViewingOrigin()) scrollDown();
        },
        onAwaitingClarify: (data) => {
          if (!isViewingOrigin()) return;
          if (Array.isArray(data.items) && data.items.length) {
            setClarifyPending({
              items: data.items as ClarifyPending["items"],
              timeout_sec: (data.timeout_sec as number | undefined) ?? 1800,
            });
          }
          scrollDown();
        },
        onError: (msg) => {
          appendItemForSession(originSessionId, {
            type: "message",
            role: "assistant",
            content: `⚠️ ${msg}`,
          });
          if (isViewingOrigin()) scrollDown();
        },
        onDone: (opts) => {
          if (opts?.recovered) {
            if (isViewingOrigin()) scrollDown();
            void refreshFridgeMagnets();
            void flushQueueRef.current(originSessionId);
            return;
          }
          void reloadSessionIfCurrent(originSessionId);
          if (isViewingOrigin()) scrollDown();
          void refreshFridgeMagnets();
          void flushQueueRef.current(originSessionId);
        },
      });
    },
    [
      appendItemForSession,
      clarifyPending,
      refreshFridgeMagnets,
      refreshMessages,
      reloadSessionIfCurrent,
      send,
    ],
  );

  flushQueueRef.current = async (sessionId: string) => {
    const next = useChatStore.getState().peekQueue(sessionId);
    if (!next || sendingRef.current) return;
    const item = useChatStore.getState().takeQueued(next.id);
    if (!item) return;
    appendItemForSession(item.sessionId, {
      type: "message",
      role: "user",
      content: item.text,
    });
    scrollDown();
    sendingRef.current = true;
    try {
      await dispatchSend(item.text, item.sessionId);
    } finally {
      sendingRef.current = false;
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !currentId || sendingRef.current) return;

    if (streamVisible) {
      useChatStore.getState().enqueue(currentId, text);
      setInputText("");
      saveInputDraft(currentId, "");
      requestAnimationFrame(resizeInput);
      return;
    }

    const originSessionId = currentId;
    sendingRef.current = true;
    setInputText("");
    saveInputDraft(originSessionId, "");
    requestAnimationFrame(resizeInput);
    appendItem({ type: "message", role: "user", content: text });

    try {
      await dispatchSend(text, originSessionId);
    } finally {
      sendingRef.current = false;
    }
  };

  const sendQueuedNow = async (queueId: string) => {
    if (!currentId || sendingRef.current) return;
    const item = useChatStore.getState().takeQueued(queueId);
    if (!item || item.sessionId !== currentId) return;

    sendingRef.current = true;
    appendItemForSession(item.sessionId, {
      type: "message",
      role: "user",
      content: item.text,
    });
    scrollDown();
    try {
      await dispatchSend(item.text, item.sessionId);
    } finally {
      sendingRef.current = false;
    }
  };

  const stopStreaming = async () => {
    if (!currentId || !streamVisible) return;
    await useChatStore.getState().stop(currentId);
  };

  const onInputKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCmdMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        applyCommand(filteredCommands[selectedCmdIdx]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        saveInputDraft(currentId, "");
        setSelectedCmdIdx(0);
        requestAnimationFrame(resizeInput);
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void sendMessage();
  };

  const sapDisconnected = sapConnection !== "connected";

  if (!ready && !error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-bold">{m.webui_chat_title()}</h2>
          <p className="text-sm text-error">{error}</p>
          <p className="text-xs text-base-content/60">
            请确认 `anima service start` 已运行，且 config.yaml 中配置了 satellites.chat。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col min-h-0">
      {sapDisconnected ? (
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-warning/15 border-b border-warning/30 text-sm">
          <span className="text-warning-content/90">
            {sapConnection === "connecting"
              ? m.webui_common_connecting()
              : m.webui_studio_disconnected()}
          </span>
          <button
            type="button"
            className="btn btn-xs btn-warning"
            disabled={sapConnection === "connecting"}
            onClick={() => void reconnectSap()}
          >
            {m.webui_common_reconnect()}
          </button>
        </div>
      ) : null}
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-200">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square lg:hidden"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <span className="text-sm font-medium">{m.webui_chat_title()}</span>
        <span className="flex-1" />
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => setLocale(toggleAppLocale())}
        >
          {locale === "zh-cn" ? "EN" : "中文"}
        </button>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen ? (
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={[
            "shrink-0 w-64 flex flex-col border-r border-base-300 bg-base-200/30 min-h-0",
            sidebarOpen ? "fixed inset-y-0 left-0 z-40 lg:static" : "hidden lg:flex",
          ].join(" ")}
        >
          <div className="p-2">
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              onClick={() => void newSession()}
            >
              {m.webui_common_new_session()}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={["session-item", s.id === currentId ? "sidebar-nav-active" : ""].join(
                  " ",
                )}
                onClick={() => void navigateToSession(s.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    sessionId: s.id,
                  });
                }}
              >
                <div className="truncate">{sessionLabel(s)}</div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {acpDock ? (
            <div className="shrink-0 px-4 pt-3">
              <AcpProgressDock dock={acpDock} />
            </div>
          ) : null}

          <div ref={msgAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {!currentId ? (
              <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
                {m.webui_chat_select_session()}
              </div>
            ) : display.length === 0 && !streamVisible && !recovering ? (
              <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
                {m.webui_chat_send_first_message()}
              </div>
            ) : null}

            {display.map((item, i) => {
              if (item.type === "message" && item.role === "user") {
                return (
                  <div key={`d${i}`} className="chat chat-end">
                    <div className="chat-bubble chat-bubble-primary whitespace-pre-wrap">
                      {item.content}
                    </div>
                  </div>
                );
              }
              if (item.type === "message" && item.role === "assistant") {
                return (
                  <div key={`d${i}`} className="chat chat-start">
                    <div className="chat-bubble">
                      <div
                        className="md-content"
                        dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                      />
                    </div>
                  </div>
                );
              }
              if (item.type === "tool_block") {
                return (
                  <div key={`d${i}`} className="chat chat-start max-w-full">
                    <ToolBlockBubble calls={item.calls} />
                  </div>
                );
              }
              return null;
            })}

            {clarifyPending ? (
              <div className="alert alert-info shadow-sm">
                <div className="w-full space-y-2">
                  <p className="font-medium">{m.webui_chat_clarify_hint()}</p>
                  {clarifyPending.items.map((item, ci) => (
                    <div key={ci} className="text-sm">
                      <p>
                        {ci + 1}. {item.question}
                      </p>
                      {item.choices?.length ? (
                        <ul className="list-disc list-inside ml-2 text-base-content/70">
                          {item.choices.map((choice, chi) => (
                            <li key={chi}>{choice}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {streamVisible && streamText ? (
              <div className="chat chat-start">
                <div className="chat-bubble">
                  <div
                    className="md-content"
                    dangerouslySetInnerHTML={{ __html: renderMd(streamText) }}
                  />
                  <span className="loading loading-dots loading-xs" />
                </div>
              </div>
            ) : null}

            {recovering ? (
              <div className="chat chat-start">
                <div className="chat-bubble text-base-content/60 text-sm flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs" />
                  {m.webui_chamber_message_waiting_result()}
                </div>
              </div>
            ) : null}
          </div>

          <FridgeMagnetInjectPreview
            injectText={fridgeData.inject_text}
            magnetCount={fridgeData.magnets.length}
            redisConfigured={fridgeData.redis_configured}
            loading={fridgeLoading}
            onRefresh={() => void refreshFridgeMagnets()}
          />

          <div className="border-t border-base-300 p-4 bg-base-100 relative">
            {messageQueue.length > 0 ? (
              <ul className="mb-2 space-y-1">
                {messageQueue.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-sm bg-base-200/60 rounded-lg px-2 py-1.5"
                  >
                    <span className="flex-1 truncate text-base-content/80">{item.text}</span>
                    <button
                      type="button"
                      className="btn btn-xs btn-primary shrink-0"
                      onClick={() => void sendQueuedNow(item.id)}
                    >
                      {m.webui_chat_queue_send_now()}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              className="flex gap-2 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (streamVisible) {
                  void stopStreaming();
                } else {
                  void sendMessage();
                }
              }}
            >
              <div className="flex-1 relative">
                {showCmdMenu ? (
                  <ul className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg z-10">
                    {filteredCommands.map((cmd, i) => (
                      <li
                        key={cmd.name}
                        className={[
                          "px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-base-200",
                          i === selectedCmdIdx ? "bg-primary/15" : "",
                        ].join(" ")}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyCommand(cmd);
                        }}
                      >
                        <span className="font-mono font-medium shrink-0">/{cmd.name}</span>
                        <span className="text-xs text-base-content/60 truncate">
                          {cmd.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <textarea
                  ref={msgInputRef}
                  value={inputText}
                  onChange={(e) => {
                    const next = e.target.value;
                    setInputText(next);
                    saveInputDraft(currentId, next);
                    setSelectedCmdIdx(0);
                    resizeInput();
                  }}
                  rows={1}
                  className="textarea textarea-bordered w-full min-h-[2.75rem] max-h-48 resize-none leading-normal py-2.5"
                  placeholder={m.webui_chat_message_placeholder()}
                  disabled={!currentId || sapDisconnected}
                  onKeyDown={onInputKeydown}
                />
              </div>
              {streamVisible ? (
                <button
                  type="submit"
                  className="btn btn-error"
                  disabled={!currentId || sapDisconnected}
                >
                  {m.webui_common_stop()}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!currentId || !inputText.trim() || sapDisconnected}
                >
                  {m.webui_common_send()}
                </button>
              )}
            </form>
          </div>
        </main>
      </div>

      {contextMenu.visible ? (
        <div
          className="fixed z-50 bg-base-100 border border-base-300 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div
            className="px-3 py-1.5 hover:bg-base-300 cursor-pointer text-sm"
            onClick={startRename}
          >
            {m.webui_common_rename()}
          </div>
        </div>
      ) : null}

      {showRenameDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowRenameDialog(false)}
        >
          <div
            className="bg-base-100 rounded-xl p-5 shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-3">{m.webui_common_edit_title()}</h3>
            <input
              ref={renameInputRef}
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              type="text"
              className="input input-bordered w-full text-sm"
              placeholder={m.webui_common_title_placeholder()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmRename();
                if (e.key === "Escape") setShowRenameDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowRenameDialog(false)}
              >
                {m.webui_common_cancel()}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void confirmRename()}
              >
                {m.webui_common_confirm()}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
