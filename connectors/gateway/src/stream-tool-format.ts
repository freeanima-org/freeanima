/** 网关流式工具行格式化（Discord / 微信共用） */

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

/** 🔧 tool_name({"key":"val"}) — 整行截断 */
export function formatToolBeginLine(
  name: string,
  args: Record<string, unknown>,
  maxLen = TOOL_LINE_MAX,
): string {
  const inner = serializeToolArgs(args);
  const full = `🔧 ${name}(${inner})`;
  return truncateText(full, maxLen);
}

/** → 结果摘要（截断） */
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

export function formatToolErrorLine(content: string, maxLen = TOOL_RESULT_MAX): string {
  const prefix = "❌ ";
  const budget = Math.max(1, maxLen - prefix.length);
  const oneLine = content.replace(/\s+/g, " ").trim();
  return `${prefix}${truncateText(oneLine, budget)}`;
}

export function formatToolRoundMessage(lines: string[]): string {
  return lines.filter((l) => l.trim().length > 0).join("\n");
}

/** 缓冲一轮 tool_begin / tool_result，轮次结束时 take() 合并为一条 */
export class ToolRoundCollector {
  private lines: string[] = [];

  addBegin(name: string, args: Record<string, unknown>): void {
    if (isClarifyTool(name)) return;
    this.lines.push(formatToolBeginLine(name, args));
  }

  addResult(name: string, content: string): void {
    if (isClarifyTool(name)) return;
    this.lines.push(formatToolResultLine(name, content));
  }

  addError(content: string): void {
    this.lines.push(formatToolErrorLine(content));
  }

  get hasContent(): boolean {
    return this.lines.length > 0;
  }

  take(): string | null {
    if (this.lines.length === 0) return null;
    const msg = formatToolRoundMessage(this.lines);
    this.lines = [];
    return msg.trim() ? msg : null;
  }
}
