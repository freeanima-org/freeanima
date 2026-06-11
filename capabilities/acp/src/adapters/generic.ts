import type { AcpAgentAdapter } from "./types.ts";

const TOOL_LINE_MAX = 120;

function normalizeUpdateKind(update: Record<string, unknown>): string {
  const raw = update.sessionUpdate ?? update.type ?? "";
  return String(raw).toLowerCase().replace(/_/g, "");
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return "…";
  return `${text.slice(0, maxLen - 1)}…`;
}

function serializeToolArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args);
  } catch {
    return "{}";
  }
}

/** Format tool line with args (aligned with gateway stream-tool-format) */
export function formatAcpToolLine(
  name: string,
  args: Record<string, unknown>,
  maxLen = TOOL_LINE_MAX,
): string {
  const inner = serializeToolArgs(args);
  const full = `🔧 ${name}(${inner})`;
  return truncateText(full, maxLen);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Extract tool arguments from ACP session/update payloads */
export function extractToolArgs(update: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["arguments", "args", "input", "parameters"] as const) {
    const rec = asRecord(update[key]);
    if (rec && Object.keys(rec).length) return rec;
  }
  const content = asRecord(update.content);
  if (content) {
    for (const key of ["arguments", "args", "input", "parameters"] as const) {
      const rec = asRecord(content[key]);
      if (rec && Object.keys(rec).length) return rec;
    }
  }
  return {};
}

/** extract text or tool hint from session/update */
export function parseSessionUpdateChunk(update: Record<string, unknown>): string | null {
  const kind = normalizeUpdateKind(update);
  if (kind === "agentmessagechunk") {
    const content = update.content;
    if (typeof content === "object" && content !== null) {
      const text = (content as Record<string, unknown>).text;
      if (typeof text === "string" && text) return text;
    }
    if (typeof update.text === "string" && update.text) return update.text;
    return null;
  }
  if (kind === "toolcall") {
    const name = update.name ?? update.toolName ?? "?";
    const args = extractToolArgs(update);
    return `\n${formatAcpToolLine(String(name), args)}`;
  }
  return null;
}

export const genericAcpAdapter: AcpAgentAdapter = {
  id: "generic",
  parseSessionUpdate: parseSessionUpdateChunk,
  handleServerRequest(method, params, _ctx?) {
    if (method === "session/request_permission") {
      return permissionAllowOnce(params);
    }
    return null;
  },
};

/** Cursor docs: outcome.selected + optionId allow-once */
export function permissionAllowOnce(_params: Record<string, unknown>): Record<string, unknown> {
  return { outcome: { outcome: "selected", optionId: "allow-once" } };
}
