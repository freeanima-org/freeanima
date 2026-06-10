import type { AcpAgentAdapter } from "./types.ts";

function normalizeUpdateKind(update: Record<string, unknown>): string {
  const raw = update.sessionUpdate ?? update.type ?? "";
  return String(raw).toLowerCase().replace(/_/g, "");
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
    return `\n🔧 ${String(name)}(...)`;
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
