import { describe, expect, test } from "bun:test";

import { applyStreamEvent, newMsgId, type CodingChatMessage } from "./chat-thread.ts";

describe("chat-thread", () => {
  test("token 追加 / content_replace / done", () => {
    const asst = newMsgId("asst");
    let msgs: CodingChatMessage[] = [
      { id: "u1", role: "user", content: "hi" },
      { id: asst, role: "assistant", content: "", streaming: true },
    ];
    msgs = applyStreamEvent(msgs, asst, { event: "token", data: { content: "Hel" } });
    msgs = applyStreamEvent(msgs, asst, { event: "token", data: { content: "lo" } });
    expect(msgs.find((m) => m.id === asst)?.content).toBe("Hello");
    msgs = applyStreamEvent(msgs, asst, {
      event: "content_replace",
      data: { content: "Hello!" },
    });
    expect(msgs.find((m) => m.id === asst)?.content).toBe("Hello!");
    msgs = applyStreamEvent(msgs, asst, { event: "done", data: {} });
    expect(msgs.find((m) => m.id === asst)?.streaming).toBe(false);
  });
});
