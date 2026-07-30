import { useState } from "react";
import type { DisplayToolCall } from "@freeanima/shared/rpc-contract/frames/display.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";

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

function callIntentTitle(args: Record<string, unknown> | undefined): string | undefined {
  const v = args?._title;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatArgsForDisplay(args: Record<string, unknown>): Record<string, unknown> {
  if (!("_title" in args)) return args;
  const { _title: _removed, ...rest } = args;
  return rest;
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
  return `${text.slice(0, max)}\n${m.habitat_message_truncated()}`;
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
            {m.habitat_message_tool_calls({ count: String(calls.length) })}
          </div>
          {calls.map((c, ci) => {
            const intent = callIntentTitle(c.args);
            return (
              <div key={c.tool_call_id || ci} className="flex items-center gap-1.5 truncate">
                <span className={`shrink-0 font-mono ${statusClass(c.status)}`}>
                  {statusIcon(c.status)}
                </span>
                <span className="truncate font-medium">{intent ?? c.name}</span>
                {intent ? (
                  <span className="font-mono text-foreground/40 text-[10px] shrink-0 truncate">
                    {c.name}
                  </span>
                ) : c.argsPreview ? (
                  <span className="font-mono text-foreground/40 text-[10px] truncate">
                    ({c.argsPreview})
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border/50 px-3 py-2 space-y-3">
          {calls.map((c, ci) => {
            const intent = callIntentTitle(c.args);
            const displayArgs = c.args ? formatArgsForDisplay(c.args) : undefined;
            return (
              <div
                key={`detail-${c.tool_call_id || ci}`}
                className="rounded-lg bg-background/60 p-2 space-y-1.5"
              >
                <div className="flex items-center gap-2 font-medium">
                  <span className={statusClass(c.status)}>{statusIcon(c.status)}</span>
                  <span>{intent ?? c.name}</span>
                  {intent ? (
                    <span className="font-mono text-foreground/40 text-[10px]">{c.name}</span>
                  ) : null}
                  {c.tool_call_id ? (
                    <span className="text-foreground/40 text-[10px]">
                      {c.tool_call_id.slice(0, 8)}
                    </span>
                  ) : null}
                </div>
                {displayArgs && Object.keys(displayArgs).length > 0 ? (
                  <div>
                    <div className="text-muted-foreground mb-0.5">{m.habitat_message_args()}</div>
                    <pre className="text-[11px] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                      {formatJson(displayArgs)}
                    </pre>
                  </div>
                ) : null}
                {c.result ? (
                  <div>
                    <div className="text-muted-foreground mb-0.5">{m.habitat_message_result()}</div>
                    <pre className="text-[11px] overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                      {truncateResult(c.result)}
                    </pre>
                  </div>
                ) : c.status === "pending" ? (
                  <div className="text-foreground/40 italic">
                    {m.habitat_message_waiting_result()}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
