import { useEffect, useRef, useState } from "react";

import { fetchCodingConversationHistory } from "../lib/chat-history.ts";
import { applyStreamEvent, newMsgId, type CodingChatMessage } from "../lib/chat-thread.ts";
import { getCodingStreamClient, type StreamApiLikeEvent } from "../lib/coding-stream-client.ts";

type Props = {
  /** 切换 Agent 时重置线程；勿用 conversationId（首条消息绑定时会变） */
  sessionKey: string;
  conversationId: string | null;
  disabled?: boolean;
  placeholder?: string;
  onNeedConversation: (message: string) => Promise<string | null>;
  onTitleHint?: (text: string) => void;
};

export function AgentChatPane({
  sessionKey,
  conversationId,
  disabled,
  placeholder,
  onNeedConversation,
  onTitleHint,
}: Props) {
  const [messages, setMessages] = useState<CodingChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // 仅在切换 Agent 时重置并拉历史；conversationId 首绑不重跑，避免冲掉进行中的流式回复
  useEffect(() => {
    let cancelled = false;
    unsubRef.current?.();
    unsubRef.current = null;
    setDraft("");
    setError(null);
    setBusy(false);
    setMessages([]);

    const cid = conversationId;
    if (!cid) {
      setHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setHistoryLoading(true);
    void fetchCodingConversationHistory(cid)
      .then((msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        setHistoryLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setHistoryLoading(false);
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 有意只跟 sessionKey；conversationId 取切换当下的值
  }, [sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy || disabled || historyLoading) return;
    setDraft("");
    setError(null);
    setBusy(true);
    onTitleHint?.(message);

    let cid = conversationIdRef.current;
    if (!cid) {
      try {
        cid = await onNeedConversation(message);
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : String(e));
        setDraft(message);
        return;
      }
      if (!cid) {
        setBusy(false);
        setError("无法创建 Habitat 对话（检查 Outpost / Token）");
        setDraft(message);
        return;
      }
    }

    const userId = newMsgId("user");
    const assistantId = newMsgId("asst");
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: message },
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    unsubRef.current?.();
    const client = getCodingStreamClient();
    const handle = client.sendMessageStream(
      { conversationId: cid, message },
      {
        onData: (ev: StreamApiLikeEvent) => {
          setMessages((prev) => applyStreamEvent(prev, assistantId, ev));
          if (ev.event === "done" || ev.event === "error" || ev.event === "interrupted") {
            setBusy(false);
          }
          if (ev.event === "error") {
            setError(ev.data.error);
          }
        },
        onError: (err) => {
          setBusy(false);
          setError(err.message);
          setMessages((prev) =>
            applyStreamEvent(prev, assistantId, {
              event: "error",
              data: { error: err.message },
            }),
          );
        },
        onComplete: () => {
          setBusy(false);
        },
      },
    );
    unsubRef.current = handle.unsubscribe;
  };

  const empty = messages.length === 0 && !historyLoading;

  return (
    <section className="coding-pane coding-chat" aria-label="Agent 对话">
      {error ? <div className="coding-error">{error}</div> : null}

      {historyLoading ? (
        <div className="coding-chat-hero">
          <p className="muted">加载对话历史…</p>
        </div>
      ) : empty ? (
        <div className="coding-chat-hero">
          <h1 className="coding-chat-hero-title">Agent</h1>
          <p className="muted coding-chat-hero-sub">描述任务，或在右侧查看文件与变更</p>
          <form
            className="coding-chat-compose coding-chat-compose-hero"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <textarea
              className="coding-chat-input"
              rows={3}
              value={draft}
              disabled={disabled || busy}
              placeholder={placeholder ?? "交给 Agent…"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
            />
            <button
              type="submit"
              className="coding-btn coding-btn-primary"
              disabled={disabled || busy || !draft.trim()}
            >
              发送
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="coding-chat-thread">
            {messages.map((m) => (
              <div key={m.id} className={`coding-chat-msg role-${m.role}`}>
                <div className="coding-chat-role">
                  {m.role === "user"
                    ? "你"
                    : m.role === "assistant"
                      ? "Agent"
                      : m.role === "tool"
                        ? "工具"
                        : "系统"}
                  {m.streaming ? " …" : ""}
                </div>
                <pre className="coding-chat-body">{m.content || (m.streaming ? "…" : "")}</pre>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form
            className="coding-chat-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <textarea
              className="coding-chat-input"
              rows={2}
              value={draft}
              disabled={disabled || busy}
              placeholder="继续对话…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
            />
            <button
              type="submit"
              className="coding-btn coding-btn-primary"
              disabled={disabled || busy || !draft.trim()}
            >
              发送
            </button>
          </form>
        </>
      )}
    </section>
  );
}
