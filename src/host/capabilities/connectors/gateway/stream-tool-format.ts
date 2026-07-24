/** Gateway streaming tool line formatting (Discord / WeChat shared) */

import type { StructuredToolCall } from "@freeanima/host/engine/loop/stream-reply";
import { ToolRoundBuffer, isClarifyTool } from "@freeanima/host/engine/loop/stream-reply";
import type { ToolDisplayMode } from "./tool-display.ts";

export { isClarifyTool, ToolRoundBuffer };

export const TOOL_LINE_MAX = 120;
export const TOOL_RESULT_MAX = 200;

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

/** 结构化 tool round → IM 文本（Gateway 专用） */
export function formatStructuredToolRound(
  calls: StructuredToolCall[],
  mode: ToolDisplayMode = "name",
): string | null {
  if (calls.length === 0) return null;
  if (mode === "hidden") return null;
  if (mode === "count") {
    return formatToolRoundCount(calls.length);
  }

  const lines: string[] = [];
  for (const call of calls) {
    const args = call.args ?? {};
    if (mode === "name") {
      lines.push(formatToolNameLine(call.name));
    } else if (mode === "name_args_truncated") {
      lines.push(formatToolBeginLine(call.name, args));
    } else if (mode === "name_args_full" || mode === "name_args_result_full") {
      lines.push(formatToolBeginLine(call.name, args, Number.MAX_SAFE_INTEGER));
    }
    if (call.result) {
      if (mode === "name_args_result_full") {
        const line = formatToolResultFullLine(call.name, call.result);
        if (line) lines.push(line);
      } else if (mode === "name_args_truncated" || mode === "name_args_full") {
        if (call.status === "error") {
          lines.push(formatToolErrorLine(call.result));
        } else {
          lines.push(formatToolResultLine(call.name, call.result));
        }
      }
    }
  }

  const msg = formatToolRoundMessage(lines);
  return msg.trim() ? msg : null;
}
