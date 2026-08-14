import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import type { DisplayItem } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

import { emptyCodingThread, type CodingThreadState } from "./chat-thread.ts";

/** 与 Chat `CHAT_MESSAGES_PAGE_SIZE` 对齐 */
const CODING_MESSAGES_PAGE_SIZE = 100;

export type CodingHistoryPage = {
  display: DisplayItem[];
  fromPos: number | null;
  hasMoreBefore: boolean;
};

function normalizeDisplay(raw: unknown): DisplayItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DisplayItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: string };
    if (row.type === "message") {
      const m = item as {
        role?: string;
        content?: unknown;
        attachments?: Array<{ filename: string; mime_type: string; size: number }>;
      };
      if (m.role !== "user" && m.role !== "assistant") continue;
      out.push({
        type: "message",
        role: m.role,
        content: typeof m.content === "string" ? m.content : coerceString(m.content),
        ...(m.attachments?.length ? { attachments: m.attachments } : {}),
      });
      continue;
    }
    if (row.type === "tool_block") {
      const block = item as { calls?: unknown };
      if (!Array.isArray(block.calls)) {
        out.push({ type: "tool_block", calls: [] });
        continue;
      }
      out.push({
        type: "tool_block",
        calls: block.calls
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .map((c, i) => ({
            name: typeof c.name === "string" ? c.name : "?",
            argsPreview: typeof c.argsPreview === "string" ? c.argsPreview : "",
            tool_call_id: typeof c.tool_call_id === "string" ? c.tool_call_id : `hist-${i}`,
            status: typeof c.status === "string" ? c.status : "done",
            ...(c.args && typeof c.args === "object" && !Array.isArray(c.args)
              ? { args: c.args as Record<string, unknown> }
              : {}),
            ...(typeof c.result === "string" ? { result: c.result } : {}),
          })),
      });
    }
  }
  return out;
}

function pageFromResponse(resp: {
  display?: unknown;
  from_pos?: unknown;
  has_more_before?: unknown;
}): CodingHistoryPage {
  return {
    display: normalizeDisplay(resp.display),
    fromPos: typeof resp.from_pos === "number" ? resp.from_pos : null,
    hasMoreBefore: resp.has_more_before === true,
  };
}

/** 拉取会话历史（尾页）→ Coding 线程状态 */
export async function fetchCodingConversationHistory(
  conversationId: string,
  opts?: { limit?: number },
): Promise<CodingThreadState> {
  const client = getTypedHabitatClient();
  const resp = await client.call("conversation.messages", {
    conversation_id: conversationId,
    limit: opts?.limit ?? CODING_MESSAGES_PAGE_SIZE,
  });
  const page = pageFromResponse(resp);
  return {
    ...emptyCodingThread(),
    display: page.display,
    fromPos: page.fromPos,
    hasMoreBefore: page.hasMoreBefore,
  };
}

/** 向上加载更早一页（before_pos） */
export async function fetchCodingOlderMessages(
  conversationId: string,
  beforePos: number,
  opts?: { limit?: number },
): Promise<CodingHistoryPage> {
  const client = getTypedHabitatClient();
  const resp = await client.call("conversation.messages", {
    conversation_id: conversationId,
    limit: opts?.limit ?? CODING_MESSAGES_PAGE_SIZE,
    before_pos: beforePos,
  });
  return pageFromResponse(resp);
}
