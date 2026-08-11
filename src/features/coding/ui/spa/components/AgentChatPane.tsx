import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useChatLlmDebugEnabled } from "@freeanima/client/portal-sdk/react.tsx";
import { ConversationTranscript } from "@freeanima/features/chat/ui/spa/components/ConversationTranscript.tsx";
import { LlmDebugPanel } from "@freeanima/features/chat/ui/spa/components/LlmDebugPanel.tsx";
import { SlashCommandResultPanel } from "@freeanima/features/chat/ui/spa/components/SlashCommandResultPanel.tsx";
import {
  fetchLlmDebug,
  listConversationCommands,
  runConversationCommand,
} from "@freeanima/features/chat/ui/spa/lib/conversation-command-api.ts";
import { m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";
import {
  buildSlashMenuEntries,
  type SlashCommandItem,
  type SlashMenuEntry,
} from "@freeanima/features/chat/ui/spa/lib/slash-command-menu.ts";
import { mergeLlmDebugSnapshot } from "@freeanima/features/chat/ui/spa/lib/stream-events.ts";
import type {
  LlmDebugSnapshotPayload,
  LlmDebugSnapshots,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { toast } from "@freeanima/ui-kit/composite";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";
import { Button } from "@freeanima/ui-kit";

import { fetchCodingConversationHistory, fetchCodingOlderMessages } from "../lib/chat-history.ts";
import {
  appendUserMessage,
  applyCodingStreamEvent,
  commitStreamTextIfAny,
  emptyCodingThread,
  type CodingThreadState,
} from "../lib/chat-thread.ts";
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

function renderMd(text: string): string {
  return renderMarkdownHtml(text);
}

export function AgentChatPane({
  sessionKey,
  conversationId,
  disabled,
  placeholder,
  onNeedConversation,
  onTitleHint,
}: Props) {
  const [thread, setThread] = useState<CodingThreadState>(() => emptyCodingThread());
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandList, setCommandList] = useState<SlashCommandItem[]>([]);
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [slashResult, setSlashResult] = useState<{
    command: string;
    text: string;
    loading?: boolean;
  } | null>(null);
  const llmDebugEnabled = useChatLlmDebugEnabled();
  const [debugViewerOpen, setDebugViewerOpen] = useState(false);
  const [llmDebugLoading, setLlmDebugLoading] = useState(false);
  const [llmDebugSnapshots, setLlmDebugSnapshots] = useState<LlmDebugSnapshots | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const threadRef = useRef(thread);
  threadRef.current = thread;
  const loadingOlderRef = useRef(false);

  const slashMenuEntries = useMemo(
    () => buildSlashMenuEntries(draft, commandList),
    [draft, commandList],
  );
  const showCmdMenu = slashMenuEntries.length > 0;

  useEffect(() => {
    let cancelled = false;
    void listConversationCommands({ all: true })
      .then((raw) => {
        if (cancelled) return;
        setCommandList((raw as { commands?: SlashCommandItem[] }).commands ?? []);
      })
      .catch((e) => console.error("coding commands:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedCmdIdx((i) =>
      slashMenuEntries.length === 0 ? 0 : Math.min(i, slashMenuEntries.length - 1),
    );
  }, [slashMenuEntries]);

  useEffect(() => {
    let cancelled = false;
    unsubRef.current?.();
    unsubRef.current = null;
    setDraft("");
    setError(null);
    setBusy(false);
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    setThread(emptyCodingThread());
    setSlashResult(null);
    setDebugViewerOpen(false);
    setLlmDebugSnapshots(null);

    const cid = conversationId;
    if (!cid) {
      setHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setHistoryLoading(true);
    void fetchCodingConversationHistory(cid)
      .then((next) => {
        if (cancelled) return;
        setThread(next);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 有意只跟 sessionKey
  }, [sessionKey]);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!debugViewerOpen || !conversationId) return;
    let cancelled = false;
    setLlmDebugLoading(true);
    void fetchLlmDebug(conversationId)
      .then((data) => {
        if (cancelled) return;
        setLlmDebugSnapshots({
          ...(data.initial ? { initial: data.initial } : {}),
          ...(data.final ? { final: data.final } : {}),
        });
      })
      .catch(() => {
        if (!cancelled) setLlmDebugSnapshots(null);
      })
      .finally(() => {
        if (!cancelled) setLlmDebugLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debugViewerOpen, conversationId]);

  const loadOlder = useCallback(async (): Promise<boolean> => {
    const cid = conversationIdRef.current;
    const cur = threadRef.current;
    if (
      !cid ||
      !cur.hasMoreBefore ||
      cur.fromPos == null ||
      loadingOlderRef.current ||
      historyLoading
    ) {
      return false;
    }
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await fetchCodingOlderMessages(cid, cur.fromPos);
      if (conversationIdRef.current !== cid) return false;
      if (page.display.length === 0) {
        setThread((prev) => ({
          ...prev,
          hasMoreBefore: page.hasMoreBefore,
          fromPos: page.fromPos ?? prev.fromPos,
        }));
        return false;
      }
      setThread((prev) => ({
        ...prev,
        display: [...page.display, ...prev.display],
        fromPos: page.fromPos ?? prev.fromPos,
        hasMoreBefore: page.hasMoreBefore,
      }));
      return true;
    } catch (e) {
      console.error("coding loadOlder:", e);
      return false;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [historyLoading]);

  const applyMenuEntry = (entry: SlashMenuEntry) => {
    setDraft(entry.insertText);
    setSelectedCmdIdx(0);
  };

  const onLlmDebug = (snapshot: LlmDebugSnapshotPayload) => {
    setLlmDebugSnapshots((prev) => mergeLlmDebugSnapshot(prev, snapshot));
  };

  const runSlashThenMaybeSend = async (cid: string, message: string): Promise<boolean> => {
    const cmdName = message.slice(1).split(/\s+/).filter(Boolean)[0] ?? "";
    setSlashResult({ command: cmdName, text: "", loading: true });
    try {
      const result = await runConversationCommand(cid, message);
      if (result.delivery === "message") {
        setSlashResult(null);
        return false;
      }
      if (result.delivery === "rpc") {
        if (result.ux === "panel") {
          setSlashResult({ command: result.command, text: result.text });
        } else if (result.ux === "toast") {
          setSlashResult(null);
          toast(result.text, { duration: 4000 });
        } else {
          setSlashResult(null);
        }
        return true;
      }
      setSlashResult(null);
      toast("Unexpected slash command response", { duration: 5000 });
      return true;
    } catch (e) {
      setSlashResult(null);
      toast(e instanceof Error ? e.message : String(e), { duration: 5000 });
      return true;
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy || disabled || historyLoading) return;
    setDraft("");
    setError(null);
    setSelectedCmdIdx(0);
    onTitleHint?.(message);

    let cid = conversationIdRef.current;
    if (!cid) {
      setBusy(true);
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
      setBusy(false);
    }

    if (message.startsWith("/")) {
      setBusy(true);
      const done = await runSlashThenMaybeSend(cid, message);
      setBusy(false);
      if (done) return;
    }

    setBusy(true);
    setThread((prev) => appendUserMessage(prev, message));

    unsubRef.current?.();
    const client = getCodingStreamClient();
    const handle = client.sendMessageStream(
      {
        conversationId: cid,
        message,
        ...(llmDebugEnabled ? { llmDebug: true } : {}),
      },
      {
        onData: (ev: StreamApiLikeEvent) => {
          if (ev.event === "llm_debug") {
            onLlmDebug(ev.data);
          }
          setThread((prev) => applyCodingStreamEvent(prev, ev));
          if (ev.event === "done" || ev.event === "interrupted") {
            setThread((prev) => commitStreamTextIfAny(prev));
            setBusy(false);
          }
          if (ev.event === "error") {
            setError(ev.data.error);
            setBusy(false);
          }
        },
        onError: (err) => {
          setBusy(false);
          setError(err.message);
          setThread((prev) =>
            commitStreamTextIfAny(
              applyCodingStreamEvent(prev, {
                event: "error",
                data: { error: err.message },
              }),
            ),
          );
        },
        onComplete: () => {
          setBusy(false);
          setThread((prev) => (prev.streaming ? commitStreamTextIfAny(prev) : prev));
        },
      },
    );
    unsubRef.current = handle.unsubscribe;
  };

  const onInputKeydown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCmdMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.min(i + 1, slashMenuEntries.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const entry = slashMenuEntries[selectedCmdIdx];
        if (entry) applyMenuEntry(entry);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDraft("");
        setSelectedCmdIdx(0);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  const empty = thread.display.length === 0 && !thread.streamText && !historyLoading && !busy;
  const streaming = busy || thread.streaming;
  const streamVisible = thread.streamText.length > 0;

  const composeBlock = (hero: boolean) => (
    <div
      className={
        hero ? "coding-chat-compose-wrap coding-chat-compose-hero" : "coding-chat-compose-wrap"
      }
    >
      {showCmdMenu ? (
        <ul className="coding-slash-menu" role="listbox">
          {slashMenuEntries.map((entry, i) => (
            <li
              key={entry.label}
              className={i === selectedCmdIdx ? "coding-slash-item active" : "coding-slash-item"}
              onPointerDown={(ev) => {
                ev.preventDefault();
                applyMenuEntry(entry);
              }}
            >
              <span className="coding-slash-label">{entry.label}</span>
              {entry.description ? (
                <span className="coding-slash-desc muted">{entry.description}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="coding-chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          className="coding-chat-input"
          rows={hero ? 3 : 2}
          value={draft}
          disabled={disabled || busy}
          placeholder={placeholder ?? (hero ? "交给 Agent…（/ 打开命令）" : "继续对话…")}
          onChange={(e) => {
            setDraft(e.target.value);
            setSelectedCmdIdx(0);
          }}
          onKeyDown={onInputKeydown}
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
  );

  return (
    <section className="coding-pane coding-chat" aria-label="Agent 对话">
      <div className="coding-chat-column">
        <header className="coding-chat-toolbar">
          <span className="coding-chat-toolbar-title">对话</span>
          {llmDebugEnabled ? (
            <Button
              type="button"
              variant={debugViewerOpen ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              isDisabled={!conversationId || llmDebugLoading}
              onClick={() => setDebugViewerOpen((v) => !v)}
            >
              {llmDebugLoading ? m.chat_llm_debug_loading() : m.chat_llm_debug_view()}
            </Button>
          ) : null}
        </header>

        {error ? <div className="coding-error">{error}</div> : null}

        {slashResult ? (
          <div className="coding-slash-result">
            <SlashCommandResultPanel
              command={slashResult.command}
              text={slashResult.text}
              {...(slashResult.loading ? { loading: true } : {})}
              onClose={() => setSlashResult(null)}
              renderMd={renderMd}
            />
          </div>
        ) : null}

        {historyLoading ? (
          <div className="coding-chat-hero">
            <p className="muted">加载对话历史…</p>
          </div>
        ) : empty ? (
          <div className="coding-chat-hero">
            <h1 className="coding-chat-hero-title">Agent</h1>
            <p className="muted coding-chat-hero-sub">描述任务，或输入 / 使用 slash 命令</p>
            {composeBlock(true)}
          </div>
        ) : (
          <>
            <div className="coding-chat-thread">
              <ConversationTranscript
                display={thread.display}
                conversationKey={conversationId ?? sessionKey}
                streamText={thread.streamText}
                streaming={streaming}
                streamVisible={streamVisible}
                loadingOlder={loadingOlder}
                hasMoreBefore={thread.hasMoreBefore}
                messagesLoading={historyLoading}
                onLoadOlder={loadOlder}
                speech={{
                  supported: false,
                  isSpeaking: () => false,
                  toggle: () => {},
                }}
              />
            </div>
            {composeBlock(false)}
          </>
        )}
      </div>

      <LlmDebugPanel
        open={debugViewerOpen}
        onClose={() => setDebugViewerOpen(false)}
        snapshots={llmDebugSnapshots}
        loading={llmDebugLoading}
      />
    </section>
  );
}
