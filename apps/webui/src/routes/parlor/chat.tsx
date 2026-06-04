import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useChatStore } from "@/stores/chat";
import { useSessionsStore } from "@/stores/sessions";

type CommandItem = { name: string; description?: string };

type ClarifyPending = {
  items: Array<{ question: string; choices?: string[] }>;
  timeout_sec?: number;
};

type ToolCallState = { name: string; argsPreview: string; status: string };

export const Route = createFileRoute("/parlor/chat")({
  validateSearch: (search: Record<string, unknown>): { session: string | undefined } => ({
    session: typeof search.session === "string" ? search.session : undefined,
  }),
  component: ChatPage,
});

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

function ChatPage() {
  const currentId = useSessionsStore((s) => s.currentId);
  const display = useSessionsStore((s) => s.display);
  const appendItem = useSessionsStore((s) => s.appendItem);

  const renderMd = useChatStore((s) => s.renderMd);
  const streaming = useChatStore((s) => s.streaming);
  const send = useChatStore((s) => s.send);

  const msgAreaRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);

  const [inputText, setInputText] = useState("");
  const [streamAccumulated, setStreamAccumulated] = useState("");
  const [streamDone, setStreamDone] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [commandList, setCommandList] = useState<CommandItem[]>([]);
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [clarifyPending, setClarifyPending] = useState<ClarifyPending | null>(null);

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

  useEffect(() => {
    void trpc.sessions.commands
      .query({})
      .then((raw) => setCommandList((raw as { commands?: CommandItem[] }).commands ?? []))
      .catch((e) => console.error("Failed to fetch commands:", e));
  }, []);

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

  useEffect(() => {
    if (!currentId) return;
    requestAnimationFrame(() => {
      msgInputRef.current?.focus();
      resizeInput();
    });
    scrollDown();
  }, [currentId, display.length]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !currentId || streaming) return;

    setInputText("");
    requestAnimationFrame(resizeInput);

    appendItem({ type: "message", role: "user", content: text });
    if (clarifyPending) setClarifyPending(null);
    scrollDown();

    setStreamAccumulated("");
    setStreamDone(false);
    setToolCalls([]);
    setClarifyPending(null);

    let accumulated = "";
    let pendingTools: ToolCallState[] = [];

    await send(currentId, text, {
      onToken: (fullText) => {
        accumulated = fullText;
        setStreamAccumulated(fullText);
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
      onAwaitingClarify: (data) => {
        if (Array.isArray(data.items) && data.items.length) {
          setClarifyPending({
            items: data.items as ClarifyPending["items"],
            timeout_sec: (data.timeout_sec as number | undefined) ?? 1800,
          });
        }
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
        appendItem({ type: "message", role: "assistant", content: `⚠️ ${msg}` });
        setStreamAccumulated("");
        setToolCalls([]);
        scrollDown();
      },
      onDone: () => {
        setStreamDone(true);
        if (pendingTools.length > 0) {
          appendItem({
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
        const content = accumulated.trim();
        if (content) appendItem({ type: "message", role: "assistant", content });
        setStreamAccumulated("");
        scrollDown();
      },
    });
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
        setSelectedCmdIdx(0);
        requestAnimationFrame(resizeInput);
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void sendMessage();
  };

  return (
    <div className="h-full flex flex-col">
      <div ref={msgAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!currentId ? (
          <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
            选择一个会话开始对话
          </div>
        ) : display.length === 0 && !streaming ? (
          <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
            发送第一条消息
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

        {clarifyPending ? (
          <div className="alert alert-info shadow-sm">
            <div className="w-full space-y-2">
              <p className="font-medium">需要你确认（一条消息回复全部，或发送 /cancel）</p>
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

        {streaming && streamAccumulated && toolCalls.length === 0 ? (
          <div className="chat chat-start">
            <div className="chat-bubble">
              <div
                className="md-content"
                dangerouslySetInnerHTML={{ __html: renderMd(streamAccumulated) }}
              />
              {!streamDone ? <span className="loading loading-dots loading-xs" /> : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-base-300 p-4 bg-base-100 relative">
        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
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
                    <span className="text-xs text-base-content/60 truncate">{cmd.description}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              ref={msgInputRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setSelectedCmdIdx(0);
                resizeInput();
              }}
              rows={1}
              className="textarea textarea-bordered w-full min-h-[2.75rem] max-h-48 resize-none leading-normal py-2.5"
              placeholder="输入消息（Shift+Enter 换行，Enter 发送；/ 开头是命令）"
              disabled={!currentId || streaming}
              onKeyDown={onInputKeydown}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!currentId || streaming || !inputText.trim()}
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
}
