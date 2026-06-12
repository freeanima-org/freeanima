import type {
  AssistantMessage,
  SessionMessage,
  ToolMessage,
  UserMessage,
} from "@freeanima/core/db/domain";

export function ua(pos: number, text = "u"): UserMessage {
  return { role: "user", content: text, pos };
}

export function aa(pos: number, text = "a"): AssistantMessage {
  return { role: "assistant", content: text, pos };
}

export function toolMsg(pos: number, callId = "c1"): ToolMessage {
  return { role: "tool", tool_call_id: callId, content: "ok", pos };
}

export function assistantToolCall(pos: number, callId: string): AssistantMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: [{ id: callId, type: "function", function: { name: "x", arguments: "{}" } }],
    pos,
  };
}

export function buildHistory(n: number, startPos = 1): SessionMessage[] {
  const msgs: SessionMessage[] = [];
  let pos = startPos;
  for (let i = 0; i < n; i++) {
    msgs.push(ua(pos++, `u${i}`), aa(pos++, `a${i}`));
  }
  return msgs;
}
