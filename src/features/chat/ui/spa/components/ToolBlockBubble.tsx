import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@freeanima/ui-kit";
import type { DisplayToolCall } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";

type ToolBlockBubbleProps = {
  calls: DisplayToolCall[];
};

type SubagentStep = {
  name: string;
  title?: string;
  status: string;
};

type SubagentRunResult = {
  slug?: string;
  status?: string;
  output?: string;
  tool_calls?: number;
  steps?: SubagentStep[];
  error?: string;
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

function callLabel(c: DisplayToolCall): string {
  return callIntentTitle(c.args) ?? c.name;
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

function pickHeadline(calls: DisplayToolCall[]): string {
  const active = calls.find((c) => c.status === "running" || c.status === "pending");
  if (active) return callLabel(active);
  const last = calls.at(-1);
  return last ? callLabel(last) : m.habitat_message_tool_calls({ count: String(calls.length) });
}

function parseSubagentResults(result: string | undefined): SubagentRunResult[] | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.action !== "run" || !Array.isArray(obj.results)) return null;
    return obj.results.filter(
      (r): r is SubagentRunResult => r != null && typeof r === "object" && !Array.isArray(r),
    );
  } catch {
    return null;
  }
}

function ToolCallRow({ call }: { call: DisplayToolCall }) {
  const [open, setOpen] = useState(false);
  const intent = callIntentTitle(call.args);
  const displayArgs = call.args ? formatArgsForDisplay(call.args) : undefined;
  const subagentResults = call.name === "subagent_run" ? parseSubagentResults(call.result) : null;

  return (
    <Collapsible isExpanded={open} onExpandedChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left flex items-center gap-2 px-1 py-1 rounded-md hover:bg-muted/50 min-w-0">
        <span className={`shrink-0 ${statusClass(call.status)}`}>{statusIcon(call.status)}</span>
        <span className="truncate font-medium">{intent ?? call.name}</span>
        {intent ? (
          <span className="font-mono text-foreground/40 text-[10px] shrink-0 truncate">
            {call.name}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-foreground/40 text-[10px]">{open ? "▼" : "▶"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-lg bg-background p-2 space-y-1.5 min-w-0 mt-1 mb-2">
          {displayArgs && Object.keys(displayArgs).length > 0 ? (
            <div className="min-w-0">
              <div className="text-muted-foreground mb-0.5">{m.habitat_message_args()}</div>
              <pre className="tool-bubble-scroll text-[11px] whitespace-pre-wrap break-all">
                {formatJson(displayArgs)}
              </pre>
            </div>
          ) : null}
          {subagentResults ? (
            <div className="space-y-2 min-w-0">
              {subagentResults.map((r, i) => (
                <div
                  key={`${r.slug ?? "ephemeral"}-${i}`}
                  className="rounded-md border border/40 px-2 py-1.5 space-y-1"
                >
                  <div className="flex items-center gap-2 font-medium min-w-0">
                    <span
                      className={`shrink-0 ${statusClass(r.status === "error" ? "error" : "done")}`}
                    >
                      {statusIcon(r.status === "error" ? "error" : "done")}
                    </span>
                    <span className="truncate">{r.slug ?? "ephemeral"}</span>
                    {typeof r.tool_calls === "number" ? (
                      <span className="text-foreground/40 text-[10px] shrink-0">
                        {m.habitat_message_tool_calls({ count: String(r.tool_calls) })}
                      </span>
                    ) : null}
                  </div>
                  {r.error ? (
                    <div className="text-destructive text-[11px] break-all">{r.error}</div>
                  ) : null}
                  {r.output ? (
                    <pre className="tool-bubble-scroll text-[11px] whitespace-pre-wrap break-all">
                      {truncateResult(r.output, 2000)}
                    </pre>
                  ) : null}
                  {r.steps && r.steps.length > 0 ? (
                    <ul className="space-y-0.5 pl-1">
                      {r.steps.map((s, si) => (
                        <li
                          key={`${s.name}-${si}`}
                          className="flex items-center gap-1.5 text-[11px] min-w-0"
                        >
                          <span className={`shrink-0 ${statusClass(s.status)}`}>
                            {statusIcon(s.status)}
                          </span>
                          <span className="truncate">{s.title ?? s.name}</span>
                          {s.title ? (
                            <span className="font-mono text-foreground/40 text-[10px] shrink-0 truncate">
                              {s.name}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : call.result ? (
            <div className="min-w-0">
              <div className="text-muted-foreground mb-0.5">{m.habitat_message_result()}</div>
              <pre className="tool-bubble-scroll text-[11px] whitespace-pre-wrap break-all">
                {truncateResult(call.result)}
              </pre>
            </div>
          ) : call.status === "pending" || call.status === "running" ? (
            <div className="text-foreground/40 italic">{m.habitat_message_waiting_result()}</div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolBlockBubble({ calls }: ToolBlockBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const headline = pickHeadline(calls);
  const isActive = calls.some((c) => c.status === "running" || c.status === "pending");

  return (
    <div className="tool-bubble text-xs max-w-full min-w-0">
      <Collapsible isExpanded={expanded} onExpandedChange={setExpanded}>
        <CollapsibleTrigger className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/40 rounded-2xl transition-colors min-w-0">
          <span className="shrink-0 text-muted-foreground">{expanded ? "▼" : "▶"}</span>
          <div className="flex-1 min-w-0">
            {expanded ? (
              <span className="font-medium text-muted-foreground truncate block">
                {m.habitat_message_tool_calls({ count: String(calls.length) })}
              </span>
            ) : (
              <div className="tool-bubble-marquee font-medium text-muted-foreground">
                <span className={isActive ? "tool-bubble-marquee-track" : "truncate block"}>
                  {headline}
                </span>
              </div>
            )}
          </div>
          {!expanded ? (
            <span className="shrink-0 text-foreground/40 text-[10px]">{calls.length}</span>
          ) : null}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="tool-bubble-detail border-t border/50 px-3 py-2 space-y-1">
            {calls.map((c, ci) => (
              <ToolCallRow key={c.tool_call_id || `call-${ci}`} call={c} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
