import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Input,
  Spinner,
  Textarea,
} from "@freeanima/ui-kit";
import type { ConversationListItem } from "@pair/lib/types.ts";
import { formatConversationIdDateTime } from "@pair/lib/format-datetime.ts";
import { m } from "@pair/lib/i18n.ts";
import { subscribeConversationEvents } from "@pair/lib/api.ts";
import { useChatStore } from "@pair/stores/chat.ts";
import { usePairProgrammingStore } from "@pair/stores/pair-programming.ts";

function conversationLabel(item: ConversationListItem) {
  const id = item.id;
  if (item.title) return item.title;
  const formatted = formatConversationIdDateTime(id);
  const space = formatted.indexOf(" ");
  return space > 0 ? formatted.slice(0, space) : formatted;
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

export function ConversationPanel() {
  const store = usePairProgrammingStore();
  const chatStore = useChatStore();
  const renderMd = useChatStore((s) => s.renderMd);
  const streaming = useChatStore((s) => s.streaming);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);

  const msgAreaRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [streamAccumulated, setStreamAccumulated] = useState("");
  const [streamDone, setStreamDone] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [showRename, setShowRename] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [conversationListVisible, setConversationListVisible] = useState(true);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = msgAreaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  useEffect(() => {
    scrollDown();
  }, [store.display.length]);

  useEffect(() => {
    const conversationId = store.currentConversationId;
    if (!conversationId) return;
    const sub = subscribeConversationEvents(conversationId, () => {
      void store.fetchConversations();
    });
    return () => sub.unsubscribe();
  }, [store.currentConversationId]);

  const newConversation = async () => {
    if (streaming) chatStore.abortStream();
    setStreamAccumulated("");
    setStreamDone(true);
    await store.createNewConversation();
    scrollDown();
  };

  const selectConversation = (item: ConversationListItem) => {
    const id = item.id;
    if (streaming && streamingConversationId !== id) chatStore.abortStream();
    void store.selectConversation(id);
    setStreamAccumulated("");
    setStreamDone(true);
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && renameConversationId) {
      await store.renameConversation(renameConversationId, title);
    }
    setShowRename(false);
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !store.currentConversationId || streaming) return;
    setInputText("");
    store.appendItem({ type: "message", role: "user", content: text });
    const displayBaseline = store.display.length;
    scrollDown();
    setStreamAccumulated("");
    setStreamDone(false);
    setToolCalls([]);

    let accumulated = "";
    let pendingTools: ToolCallState[] = [];

    await chatStore.send(store.currentConversationId, text, {
      recoverDisplay: (id) => store.refreshMessages(id, displayBaseline),
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
      onDone: (opts) => {
        setStreamDone(true);
        if (opts?.recovered) {
          setStreamAccumulated("");
          setToolCalls([]);
          scrollDown();
          return;
        }
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
    <div className="h-full flex flex-row min-h-0 border-l border">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div ref={msgAreaRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {!store.currentConversationId ? (
            <div className="text-center text-foreground/40 text-sm pt-8">
              {m.pair_create_or_select()}
            </div>
          ) : null}

          {store.display.map((item, i) => {
            if (item.type === "message" && item.role === "user") {
              return (
                <div key={`d${i}`} className="flex justify-end">
                  <div className="msg-bubble msg-bubble-user whitespace-pre-wrap">
                    {item.content}
                  </div>
                </div>
              );
            }
            if (item.type === "message" && item.role === "assistant") {
              return (
                <div key={`d${i}`} className="flex justify-start">
                  <div className="msg-bubble">
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
                <div key={`d${i}`} className="flex justify-start">
                  <div className="tool-bubble text-xs px-3 py-2">
                    {item.calls.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-1.5 font-mono">
                        <span className="text-green-700 dark:text-green-300 shrink-0">✓</span>
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
            <div className="flex justify-start">
              <div className="tool-bubble text-xs px-3 py-2">
                {toolCalls.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-1.5 font-mono">
                    <span className="shrink-0">
                      {t.status === "pending" ? (
                        <span className="text-foreground/40">◌</span>
                      ) : t.status === "running" ? (
                        <Spinner className="size-3 text-blue-700 dark:text-blue-300" />
                      ) : t.status === "done" ? (
                        <span className="text-green-700 dark:text-green-300">✓</span>
                      ) : (
                        <span className="text-destructive">✗</span>
                      )}
                    </span>
                    <span>{truncatePreview(`${t.name}(${t.argsPreview})`)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {streaming &&
          streamingConversationId === store.currentConversationId &&
          streamAccumulated &&
          toolCalls.length === 0 ? (
            <div className="flex justify-start">
              <div className="msg-bubble">
                <div
                  className="md-content text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMd(streamAccumulated) }}
                />
                {!streamDone ? <Spinner className="inline size-3 ml-1 align-middle" /> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <div className="flex justify-end px-2 pt-1.5 pb-0">
              <Button
                type="submit"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!store.currentConversationId || streaming || !inputText.trim()}
              >
                {m.console_common_send()}
              </Button>
            </div>
            <div className="p-2 pt-1">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                className="min-h-[2.5rem] resize-none text-sm"
                placeholder={m.pair_chat_placeholder()}
                disabled={!store.currentConversationId || streaming}
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
        className="shrink-0 w-6 flex items-center justify-center border-l border bg-muted/50 hover:bg-muted/60 cursor-pointer text-xs text-foreground/40 select-none"
        onClick={() => setConversationListVisible((v) => !v)}
        title={
          conversationListVisible
            ? m.pair_toggle_conversation_list_hide()
            : m.pair_toggle_conversation_list_show()
        }
      >
        {conversationListVisible ? "▸" : "◂"}
      </button>

      {conversationListVisible ? (
        <div className="w-48 shrink-0 flex flex-col min-h-0 bg-muted/30">
          <div className="p-2 border-b border shrink-0">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => void newConversation()}
            >
              {m.console_common_new_conversation()}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {store.conversations.map((s) => (
              <div
                key={s.id}
                className={[
                  "session-item truncate",
                  s.id === store.currentConversationId ? "sidebar-nav-active" : "",
                ].join(" ")}
                onClick={() => selectConversation(s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setRenameConversationId(s.id);
                  setRenameText(s.title || "");
                  setShowRename(true);
                }}
              >
                {conversationLabel(s)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog
        open={showRename}
        onOpenChange={(open) => {
          if (!open) setShowRename(false);
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-xs">
          <Input
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmRename();
              if (e.key === "Escape") setShowRename(false);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowRename(false)}>
              {m.console_common_cancel()}
            </Button>
            <Button type="button" size="sm" onClick={() => void confirmRename()}>
              {m.console_common_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
