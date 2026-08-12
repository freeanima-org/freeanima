import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@freeanima/ui-kit";
import type { DisplayToolCall } from "@freeanima/features/chat/ui/spa/lib/types.ts";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 折叠标题：静止截断；文案变更时旧行上滚出、新行自下滚入 */
function RollingHeadline({ text, className }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(text);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const displayRef = useRef(text);
  const pendingRef = useRef(text);

  useEffect(() => {
    pendingRef.current = text;
    if (text === displayRef.current) return;

    if (prefersReducedMotion()) {
      displayRef.current = text;
      setDisplay(text);
      setOutgoing(null);
      return;
    }

    if (outgoing !== null) return;

    setOutgoing(displayRef.current);
    displayRef.current = text;
    setDisplay(text);
  }, [text, outgoing]);

  function finishRoll() {
    setOutgoing(null);
    const latest = pendingRef.current;
    if (latest === displayRef.current) return;

    if (prefersReducedMotion()) {
      displayRef.current = latest;
      setDisplay(latest);
      return;
    }

    setOutgoing(displayRef.current);
    displayRef.current = latest;
    setDisplay(latest);
  }

  return (
    <div className={`tool-bubble-roll${className ? ` ${className}` : ""}`}>
      {outgoing !== null ? (
        <>
          <span className="tool-bubble-roll-line tool-bubble-roll-out" aria-hidden>
            {outgoing}
          </span>
          <span className="tool-bubble-roll-line tool-bubble-roll-in" onAnimationEnd={finishRoll}>
            {display}
          </span>
        </>
      ) : (
        <span className="tool-bubble-roll-line">{display}</span>
      )}
    </div>
  );
}

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

function resultRowStatus(status: string | undefined): string {
  if (status === "error") return "error";
  if (status === "running" || status === "pending") return "running";
  return "done";
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
  return `${text.slice(0, max)}\n…（已截断）`;
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

function stepLabel(step: SubagentStep): string {
  return step.title?.trim() || step.name;
}

/** 从子 results 取「最新一行」title：优先仍 running 的最后一项，否则末项 */
export function latestChildTitle(results: SubagentRunResult[] | null): string | undefined {
  if (!results || results.length === 0) return undefined;
  let lastStep: SubagentStep | undefined;
  let lastRunning: SubagentStep | undefined;
  for (const r of results) {
    const steps = r.steps;
    if (!steps) continue;
    for (const s of steps) {
      lastStep = s;
      if (s.status === "running" || s.status === "pending") lastRunning = s;
    }
  }
  const pick = lastRunning ?? lastStep;
  return pick ? stepLabel(pick) : undefined;
}

/**
 * 折叠摘要：进行中且有子 steps → 最新子 title；否则本层调用名称。
 */
export function collapsedSummary(call: DisplayToolCall): string {
  const active = call.status === "running" || call.status === "pending";
  if (active && call.name === "subagent_run") {
    const child = latestChildTitle(parseSubagentResults(call.result));
    if (child) return child;
  }
  return callLabel(call);
}

function pickHeadline(calls: DisplayToolCall[]): string {
  const active = calls.find((c) => c.status === "running" || c.status === "pending");
  if (active) return collapsedSummary(active);
  const last = calls.at(-1);
  return last ? callLabel(last) : `工具调用 · ${String(calls.length)}`;
}

function ToolCallRow({ call }: { call: DisplayToolCall }) {
  const [open, setOpen] = useState(false);
  const intent = callIntentTitle(call.args);
  const displayArgs = call.args ? formatArgsForDisplay(call.args) : undefined;
  const subagentResults = call.name === "subagent_run" ? parseSubagentResults(call.result) : null;
  const isActive = call.status === "running" || call.status === "pending";
  const rowLabel = open ? (intent ?? call.name) : collapsedSummary(call);
  const showNameHint = !open && isActive && rowLabel !== call.name && rowLabel !== intent;

  return (
    <Collapsible isExpanded={open} onExpandedChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left flex items-center gap-2 px-1 py-1 rounded-md hover:bg-muted/50 min-w-0">
        <span className={`shrink-0 ${statusClass(call.status)}`}>{statusIcon(call.status)}</span>
        <span className="min-w-0 flex-1 font-medium">
          {open ? (
            <span className="truncate block">{rowLabel}</span>
          ) : (
            <RollingHeadline text={rowLabel} />
          )}
        </span>
        {intent && (!isActive || open) ? (
          <span className="font-mono text-foreground/40 text-[10px] shrink-0 truncate">
            {call.name}
          </span>
        ) : null}
        {showNameHint ? (
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
              <div className="text-muted-foreground mb-0.5">{"参数"}</div>
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
                    <span className={`shrink-0 ${statusClass(resultRowStatus(r.status))}`}>
                      {statusIcon(resultRowStatus(r.status))}
                    </span>
                    <span className="truncate">{r.slug ?? "ephemeral"}</span>
                    {typeof r.tool_calls === "number" ? (
                      <span className="text-foreground/40 text-[10px] shrink-0">
                        {`工具调用 · ${String(r.tool_calls)}`}
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
              <div className="text-muted-foreground mb-0.5">{"结果"}</div>
              <pre className="tool-bubble-scroll text-[11px] whitespace-pre-wrap break-all">
                {truncateResult(call.result)}
              </pre>
            </div>
          ) : call.status === "pending" || call.status === "running" ? (
            <div className="text-foreground/40 italic">{"等待结果…"}</div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolBlockBubble({ calls }: ToolBlockBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const headline = pickHeadline(calls);

  return (
    <div className="tool-bubble text-xs max-w-full min-w-0">
      <Collapsible isExpanded={expanded} onExpandedChange={setExpanded}>
        <CollapsibleTrigger className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/40 rounded-2xl transition-colors min-w-0">
          <span className="shrink-0 text-muted-foreground">{expanded ? "▼" : "▶"}</span>
          <div className="flex-1 min-w-0">
            {expanded ? (
              <span className="font-medium text-muted-foreground truncate block">
                {`工具调用 · ${String(calls.length)}`}
              </span>
            ) : (
              <RollingHeadline text={headline} className="font-medium text-muted-foreground" />
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
