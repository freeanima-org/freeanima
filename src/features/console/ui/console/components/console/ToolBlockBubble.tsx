import { useState } from "react";
import type { DisplayToolCall } from "@freeanima/platform/ports/schemas/display";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";

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
    <div className="tool-bubble text-xs">
      <button
        type="button"
        className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-muted/40 rounded-2xl transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="shrink-0 mt-0.5 text-muted-foreground">{expanded ? "▼" : "▶"}</span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-medium text-muted-foreground">
            {m.console_message_tool_calls({ count: String(calls.length) })}
          </div>
          {calls.map((c, ci) => (
            <div
              key={c.tool_call_id || ci}
              className="flex items-center gap-1.5 font-mono truncate"
            >
              <span className={`shrink-0 ${statusClass(c.status)}`}>{statusIcon(c.status)}</span>
              <span className="truncate">
                {c.name}({c.argsPreview || "…"})
              </span>
            </div>
          ))}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border/50 px-3 py-2 space-y-3">
          {calls.map((c, ci) => (
            <div
              key={`detail-${c.tool_call_id || ci}`}
              className="rounded-lg bg-background/60 p-2 space-y-1.5"
            >
              <div className="flex items-center gap-2 font-mono font-medium">
                <span className={statusClass(c.status)}>{statusIcon(c.status)}</span>
                <span>{c.name}</span>
                {c.tool_call_id ? (
                  <span className="text-foreground/40 text-[10px]">
                    {c.tool_call_id.slice(0, 8)}
                  </span>
                ) : null}
              </div>
              {c.args && Object.keys(c.args).length > 0 ? (
                <div>
                  <div className="text-muted-foreground mb-0.5">{m.console_message_args()}</div>
                  <pre className="text-[11px] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                    {formatJson(c.args)}
                  </pre>
                </div>
              ) : null}
              {c.result ? (
                <div>
                  <div className="text-muted-foreground mb-0.5">{m.console_message_result()}</div>
                  <pre className="text-[11px] overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
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
