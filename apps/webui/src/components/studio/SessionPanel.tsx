import { useEffect, useRef, useState } from "react";
import type { SessionListItem } from "@freeanima/legacy-api";
import { useChatStore } from "@/stores/chat";
import { usePairProgrammingStore } from "@/stores/pair-programming";

function sessionLabel(item: SessionListItem) {
  const id = item.id;
  if (item.title) return item.title;
  const p = id.split("_");
  if (p.length >= 2) return `${p[0].slice(0, 4)}-${p[0].slice(4, 6)}-${p[0].slice(6)}`;
  return id;
}

function truncatePreview(text: string, maxLen = 30) {
  let len = 0;
  let result = "";
  for (const ch of text) {
    const w = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (len + w > maxLen) {
      result += "…";
      break;
    }
    len += w;
    result += ch;
  }
  return result;
}

type ToolCallState = { name: string; argsPreview: string; status: string };

export function SessionPanel() {
  const store = usePairProgrammingStore();
  const chatStore = useChatStore();
  const renderMd = useChatStore((s) => s.renderMd);
  const streaming = useChatStore((s) => s.streaming);
  const streamingSessionId = useChatStore((s) => s.streamingSessionId);

  const msgAreaRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [streamAccumulated, setStreamAccumulated] = useState("");
  const [streamDone, setStreamDone] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [showRename, setShowRename] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [sessionListVisible, setSessionListVisible] = useState(true);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = msgAreaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  useEffect(() => {
    scrollDown();
  }, [store.display.length]);

  const newSession = async () => {
    if (streaming) chatStore.abortStream();
    setStreamAccumulated("");
    setStreamDone(true);
    await store.createNewSession();
    scrollDown();
  };

  const selectSession = (item: SessionListItem) => {
    const id = item.id;
    if (streaming && streamingSessionId !== id) chatStore.abortStream();
    void store.selectSession(id);
    setStreamAccumulated("");
    setStreamDone(true);
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && renameSessionId) {
      await store.renameSession(renameSessionId, title);
    }
    setShowRename(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !store.currentSessionId || streaming) return;
    setInputText("");
    store.appendItem({ type: "message", role: "user", content: text });
    scrollDown();
    setStreamAccumulated("");
    setStreamDone(false);
    setToolCalls([]);

    let accumulated = "";
    let pendingTools: ToolCallState[] = [];

    await chatStore.send(store.currentSessionId, text, {
      onToken: (full) => {
        accumulated = full;
        setStreamAccumulated(full);
        scrollDown();
      },
      onToolBegin: (data) => {
        const tool = String(data.tool || "?");
        const args = (data.args || {}) as Record<string, unknown>;
        const preview = Object.keys(args)
          .slice(0, 2)
          .map((k) => `${k}=${String(args[k]).slice(0, 30)}`)
          .join(", ");
        pendingTools = [...pendingTools, { name: tool, argsPreview: preview, status: "running" }];
        setToolCalls(pendingTools);
        scrollDown();
      },
      onToolResult: (data) => {
        const tool = String(data.tool || "");
        if (tool === "clarify") return;
        pendingTools = pendingTools.map((t) =>
          t.name === tool && (t.status === "running" || t.status === "pending")
            ? { ...t, status: "done" }
            : t,
        );
        setToolCalls(pendingTools);
        scrollDown();
      },
      onToolError: (data) => {
        const tool = String(data.tool || "");
        pendingTools = pendingTools.map((t) =>
          t.name === tool && (t.status === "running" || t.status === "pending")
            ? { ...t, status: "error" }
            : t,
        );
        setToolCalls(pendingTools);
        scrollDown();
      },
      onError: (msg) => {
        setStreamDone(true);
        store.appendItem({ type: "message", role: "assistant", content: `⚠️ ${msg}` });
        setStreamAccumulated("");
        setToolCalls([]);
        scrollDown();
      },
      onDone: () => {
        setStreamDone(true);
        if (pendingTools.length > 0) {
          store.appendItem({
            type: "tool_block",
            calls: pendingTools.map((t, i) => ({
              name: t.name,
              argsPreview: t.argsPreview,
              status: "done" as const,
              tool_call_id: `stream-${i}`,
            })),
          });
          pendingTools = [];
          setToolCalls([]);
        }
        const remaining = accumulated.trim();
        if (remaining) store.appendItem({ type: "message", role: "assistant", content: remaining });
        setStreamAccumulated("");
        scrollDown();
      },
    });
  };

  return (
    <div className="h-full flex flex-row min-h-0 border-l border-base-300">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div ref={msgAreaRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {!store.currentSessionId ? (
            <div className="text-center text-base-content/40 text-sm pt-8">创建或选择会话</div>
          ) : null}

          {store.display.map((item, i) => {
            if (item.type === "message" && item.role === "user") {
              return (
                <div key={`d${i}`} className="chat chat-end">
                  <div className="chat-bubble chat-bubble-primary chat-bubble-sm whitespace-pre-wrap">
                    {item.content}
                  </div>
                </div>
              );
            }
            if (item.type === "message" && item.role === "assistant") {
              return (
                <div key={`d${i}`} className="chat chat-start">
                  <div className="chat-bubble chat-bubble-sm">
                    <div
                      className="md-content text-sm"
                      dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                    />
                  </div>
                </div>
              );
            }
            if (item.type === "tool_block") {
              return (
                <div key={`d${i}`} className="chat chat-start">
                  <div className="tool-bubble text-xs px-3 py-2">
                    {item.calls.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-1.5 font-mono">
                        <span className="text-success shrink-0">✓</span>
                        <span>{truncatePreview(`${c.name}(${c.argsPreview})`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })}

          {toolCalls.length > 0 ? (
            <div className="chat chat-start">
              <div className="tool-bubble text-xs px-3 py-2">
                {toolCalls.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-1.5 font-mono">
                    <span className="shrink-0">
                      {t.status === "pending" ? (
                        <span className="text-base-content/40">◌</span>
                      ) : t.status === "running" ? (
                        <span className="loading loading-spinner loading-xs text-info" />
                      ) : t.status === "done" ? (
                        <span className="text-success">✓</span>
                      ) : (
                        <span className="text-error">✗</span>
                      )}
                    </span>
                    <span>{truncatePreview(`${t.name}(${t.argsPreview})`)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {streaming &&
          streamingSessionId === store.currentSessionId &&
          streamAccumulated &&
          toolCalls.length === 0 ? (
            <div className="chat chat-start">
              <div className="chat-bubble chat-bubble-sm">
                <div
                  className="md-content text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMd(streamAccumulated) }}
                />
                {!streamDone ? <span className="loading loading-dots loading-xs" /> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-base-300 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <div className="flex justify-end px-2 pt-1.5 pb-0">
              <button
                type="submit"
                className="btn btn-primary btn-xs"
                disabled={!store.currentSessionId || streaming || !inputText.trim()}
              >
                发送
              </button>
            </div>
            <div className="p-2 pt-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="textarea textarea-bordered textarea-sm w-full min-h-[2.5rem] resize-none"
                placeholder="和 Agent 对话…"
                disabled={!store.currentSessionId || streaming}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
            </div>
          </form>
        </div>
      </div>

      <button
        type="button"
        className="shrink-0 w-6 flex items-center justify-center border-l border-base-300 bg-base-200/50 hover:bg-base-300/60 cursor-pointer text-xs text-base-content/40 select-none"
        onClick={() => setSessionListVisible((v) => !v)}
        title={sessionListVisible ? "收起会话列表" : "展开会话列表"}
      >
        {sessionListVisible ? "▸" : "◂"}
      </button>

      {sessionListVisible ? (
        <div className="w-48 shrink-0 flex flex-col min-h-0 bg-base-200/30">
          <div className="p-2 border-b border-base-300 shrink-0">
            <button type="button" className="btn btn-primary btn-sm w-full" onClick={() => void newSession()}>
              ＋ 新会话
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {store.sessions.map((s) => (
              <div
                key={s.id}
                className={[
                  "session-item cursor-pointer truncate text-sm",
                  s.id === store.currentSessionId ? "sidebar-nav-active" : "",
                ].join(" ")}
                onClick={() => selectSession(s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setRenameSessionId(s.id);
                  setRenameText(s.title || "");
                  setShowRename(true);
                }}
              >
                {sessionLabel(s)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showRename ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowRename(false)}
        >
          <div
            className="bg-base-100 rounded-xl p-4 shadow-2xl w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              className="input input-bordered w-full text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmRename();
                if (e.key === "Escape") setShowRename(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRename(false)}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void confirmRename()}>
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
