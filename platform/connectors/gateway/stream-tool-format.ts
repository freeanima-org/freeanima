/** Gateway streaming tool line formatting (Discord / WeChat shared) */

import type { ToolDisplayMode } from "./tool-display.ts";

export const TOOL_LINE_MAX = 120;
export const TOOL_RESULT_MAX = 200;

export function isClarifyTool(name: string): boolean {
  return name === "clarify";
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return "…";
  return `${text.slice(0, maxLen - 1)}…`;
}

export function serializeToolArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args);
  } catch {
    return "{}";
  }
}

/** 🔧 tool_name({"key":"val"}) — truncate whole line */
export function formatToolBeginLine(
  name: string,
  args: Record<string, unknown>,
  maxLen = TOOL_LINE_MAX,
): string {
  const inner = serializeToolArgs(args);
  const full = `🔧 ${name}(${inner})`;
  return truncateText(full, maxLen);
}

export function formatToolNameLine(name: string): string {
  return `🔧 ${name}`;
}

/** → result summary (truncated) */
export function formatToolResultLine(
  _name: string,
  content: string,
  maxLen = TOOL_RESULT_MAX,
): string {
  const prefix = " → ";
  const budget = Math.max(1, maxLen - prefix.length);
  const oneLine = content.replace(/\s+/g, " ").trim();
  return `${prefix}${truncateText(oneLine, budget)}`;
}

export function formatToolResultFullLine(_name: string, content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine ? ` → ${oneLine}` : "";
}

export function formatToolErrorLine(content: string, maxLen = TOOL_RESULT_MAX): string {
  const prefix = "❌ ";
  const budget = Math.max(1, maxLen - prefix.length);
  const oneLine = content.replace(/\s+/g, " ").trim();
  return `${prefix}${truncateText(oneLine, budget)}`;
}

export function formatToolRoundMessage(lines: string[]): string {
  return lines.filter((l) => l.trim().length > 0).join("\n");
}

export function formatToolRoundCount(toolCount: number): string {
  return `🔧 调用了 ${toolCount} 个工具`;
}

type ToolRoundEntry =
  | { kind: "begin"; name: string; args: Record<string, unknown> }
  | { kind: "result"; name: string; content: string }
  | { kind: "error"; content: string };

/** Buffer one round of tool_begin / tool_result, take() merges at round end */
export class ToolRoundCollector {
  private entries: ToolRoundEntry[] = [];

  constructor(private readonly mode: ToolDisplayMode = "name") {}

  addBegin(name: string, args: Record<string, unknown>): void {
    if (isClarifyTool(name)) return;
    this.entries.push({ kind: "begin", name, args });
  }

  addResult(name: string, content: string): void {
    if (isClarifyTool(name)) return;
    this.entries.push({ kind: "result", name, content });
  }

  addError(content: string): void {
    this.entries.push({ kind: "error", content });
  }

  get hasContent(): boolean {
    return this.entries.length > 0;
  }

  take(): string | null {
    if (this.entries.length === 0) return null;
    const entries = this.entries;
    this.entries = [];
    if (this.mode === "hidden") return null;

    const begins = entries.filter(
      (e): e is Extract<ToolRoundEntry, { kind: "begin" }> => e.kind === "begin",
    );
    if (this.mode === "count") {
      const count = begins.length || entries.length;
      return count > 0 ? formatToolRoundCount(count) : null;
    }

    const lines: string[] = [];
    for (const entry of entries) {
      if (entry.kind === "begin") {
        if (this.mode === "name") {
          lines.push(formatToolNameLine(entry.name));
        } else if (this.mode === "name_args_truncated") {
          lines.push(formatToolBeginLine(entry.name, entry.args));
        } else if (this.mode === "name_args_full" || this.mode === "name_args_result_full") {
          lines.push(formatToolBeginLine(entry.name, entry.args, Number.MAX_SAFE_INTEGER));
        }
      } else if (entry.kind === "result") {
        if (this.mode === "name_args_result_full") {
          const line = formatToolResultFullLine(entry.name, entry.content);
          if (line) lines.push(line);
        } else if (this.mode === "name_args_truncated" || this.mode === "name_args_full") {
          lines.push(formatToolResultLine(entry.name, entry.content));
        }
      } else if (entry.kind === "error") {
        lines.push(formatToolErrorLine(entry.content));
      }
    }

    const msg = formatToolRoundMessage(lines);
    return msg.trim() ? msg : null;
  }
}
