import type { StoredMessage } from "@freeanima/host/core/db/domain";
import { TOOL_CALL_TITLE_KEY } from "@freeanima/host/core/tool";
import type { DisplayItem, DisplayToolBlockItem } from "@freeanima/host/platform/schemas/display";
import { coerceString } from "@freeanima/shared/coerce-string";

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function argsPreviewFromObject(argsObj: Record<string, unknown>): string {
  return Object.keys(argsObj)
    .filter((k) => k !== TOOL_CALL_TITLE_KEY)
    .slice(0, 4)
    .map((k) => `${k}=${coerceString(argsObj[k] ?? "").slice(0, 40)}`)
    .join(", ");
}

/** Project conversation message sequence to Habitat display list (with tool_block aggregation) */
export function buildMessagesDisplay(all: StoredMessage[]): DisplayItem[] {
  const display: DisplayItem[] = [];
  let pendingBlock: DisplayToolBlockItem | null = null;

  const flushPendingBlock = (): void => {
    if (pendingBlock) {
      display.push(pendingBlock);
      pendingBlock = null;
    }
  };

  for (const msg of all) {
    const role = msg.role;

    if (role === "user" && msg.content) {
      flushPendingBlock();
      display.push({ type: "message", role: "user", content: msg.content });
      continue;
    }

    if (role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const calls = msg.tool_calls.map((tc) => {
        const fn = tc.function;
        const argsRaw = fn?.arguments ?? "{}";
        const argsObj = parseArgs(argsRaw);
        return {
          name: fn?.name ?? "?",
          argsPreview: argsPreviewFromObject(argsObj),
          tool_call_id: tc.id,
          status: "pending",
          args: argsObj,
        };
      });
      // 有可见 assistant 文本时先收口上一块再分段；无文本的连续 tool 轮次合并进同一 tool_block
      if (msg.content) {
        flushPendingBlock();
        display.push({ type: "message", role: "assistant", content: msg.content });
        pendingBlock = { type: "tool_block", calls };
      } else if (pendingBlock) {
        pendingBlock.calls.push(...calls);
      } else {
        pendingBlock = { type: "tool_block", calls };
      }
      continue;
    }

    if (role === "tool") {
      if (pendingBlock) {
        const call = pendingBlock.calls.find((c) => c.tool_call_id === msg.tool_call_id);
        if (call) {
          call.result = msg.content;
          const isError =
            msg.content.includes('"error"') ||
            msg.content.startsWith('{"error"') ||
            msg.content.startsWith("Error:");
          call.status = isError ? "error" : "done";
        }
      }
      continue;
    }

    if (role === "assistant" && msg.content) {
      flushPendingBlock();
      display.push({ type: "message", role: "assistant", content: msg.content });
    }
  }

  flushPendingBlock();
  return display;
}

export type PaginatedMessagesDisplay = {
  conversation_id: string;
  display: DisplayItem[];
  total: number;
  offset: number;
  limit: number | null;
};

export function paginateMessagesDisplay(
  conversationId: string,
  all: StoredMessage[],
  opts?: { offset?: number; limit?: number | null },
): PaginatedMessagesDisplay {
  const full = buildMessagesDisplay(all);
  const total = full.length;
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = opts?.limit;

  if (limit === undefined || limit == null) {
    return { conversation_id: conversationId, display: full, total, offset: 0, limit: null };
  }

  const safeLimit = Math.max(1, limit);
  return {
    conversation_id: conversationId,
    display: full.slice(offset, offset + safeLimit),
    total,
    offset,
    limit: safeLimit,
  };
}
