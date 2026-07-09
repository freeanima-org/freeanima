import { useState } from "react";
import type { DisplayToolCall } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";

type ToolBlockBubbleProps = {
  calls: DisplayToolCall[];
};

function statusIcon(status: string) {
  if (status === "pending") return "◌";
  if (status === "running") return "…";
  if (status === "error") return "✗";
  return "✓";
}

function statusClass(status: string) {
  if (status === "error") return "text-destructive";
  if (status === "pending" || status === "running") return "text-foreground/40";
  return "text-green-700 dark:text-green-300";
}

function formatJson(obj: Record<string, unknown>) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function truncateResult(text: string, max = 8000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n${m.console_message_truncated()}`;
}

export function ToolBlockBubble({ calls }: ToolBlockBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tool-bubble text-xs max-w-full min-w-0">
      <button
        type="button"
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/40 rounded-2xl transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="shrink-0 text-muted-foreground">{expanded ? "▼" : "▶"}</span>
        <span className="font-medium text-muted-foreground truncate">
          {m.console_message_tool_calls({ count: String(calls.length) })}
        </span>
      </button>

      {expanded ? (
        <div className="tool-bubble-detail border-t border/50 px-3 py-2 space-y-3">
          {calls.map((c, ci) => (
            <div
              key={`detail-${c.tool_call_id || ci}`}
              className="rounded-lg bg-background p-2 space-y-1.5 min-w-0"
            >
              <div className="flex items-center gap-2 font-mono font-medium min-w-0">
                <span className={`shrink-0 ${statusClass(c.status)}`}>{statusIcon(c.status)}</span>
                <span className="truncate">{c.name}</span>
                {c.tool_call_id ? (
                  <span className="text-foreground/40 text-[10px] shrink-0">
                    {c.tool_call_id.slice(0, 8)}
                  </span>
                ) : null}
              </div>
              {c.args && Object.keys(c.args).length > 0 ? (
                <div className="min-w-0">
                  <div className="text-muted-foreground mb-0.5">{m.console_message_args()}</div>
                  <pre className="tool-bubble-scroll text-[11px] whitespace-pre-wrap break-all">
                    {formatJson(c.args)}
                  </pre>
                </div>
              ) : null}
              {c.result ? (
                <div className="min-w-0">
                  <div className="text-muted-foreground mb-0.5">{m.console_message_result()}</div>
                  <pre className="tool-bubble-scroll text-[11px] whitespace-pre-wrap break-all">
                    {truncateResult(c.result)}
                  </pre>
                </div>
              ) : c.status === "pending" ? (
                <div className="text-foreground/40 italic">
                  {m.console_message_waiting_result()}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
