import type { StreamApiLikeEvent } from "./coding-stream-client.ts";

export type CodingChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  streaming?: boolean;
};

export function newMsgId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function applyStreamEvent(
  messages: CodingChatMessage[],
  assistantId: string,
  ev: StreamApiLikeEvent,
): CodingChatMessage[] {
  const idx = messages.findIndex((m) => m.id === assistantId);
  if (idx < 0) return messages;
  const cur = messages.at(idx);
  if (!cur) return messages;
  const replace = (patch: Partial<CodingChatMessage>) => {
    const next = [...messages];
    next[idx] = { ...cur, ...patch };
    return next;
  };

  switch (ev.event) {
    case "token":
      return replace({ content: cur.content + ev.data.content, streaming: true });
    case "content_replace":
      return replace({ content: ev.data.content, streaming: true });
    case "tool_begin":
      return [
        ...messages.slice(0, idx + 1),
        {
          id: newMsgId("tool"),
          role: "tool",
          content: `→ ${ev.data.tool}`,
        },
        ...messages.slice(idx + 1),
      ];
    case "tool_result":
    case "tool_error": {
      const line =
        ev.event === "tool_error" ? `✗ ${ev.data.tool}: ${ev.data.content}` : `✓ ${ev.data.tool}`;
      return [
        ...messages.slice(0, idx + 1),
        { id: newMsgId("tool"), role: "tool", content: line },
        ...messages.slice(idx + 1),
      ];
    }
    case "done":
    case "interrupted":
      return replace({ streaming: false });
    case "error":
      return replace({
        content: cur.content || ev.data.error,
        streaming: false,
      });
    default:
      return messages;
  }
}
