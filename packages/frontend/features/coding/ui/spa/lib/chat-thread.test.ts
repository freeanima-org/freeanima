import { describe, expect, test } from "bun:test";

import {
  appendUserMessage,
  applyCodingStreamEvent,
  commitStreamTextIfAny,
  emptyCodingThread,
} from "./chat-thread.ts";

describe("coding chat-thread", () => {
  test("token / content_replace / display_append assistant", () => {
    let s = appendUserMessage(emptyCodingThread(), "hi");
    s = applyCodingStreamEvent(s, { event: "accepted", data: {} });
    s = applyCodingStreamEvent(s, { event: "token", data: { content: "Hel" } });
    s = applyCodingStreamEvent(s, { event: "token", data: { content: "lo" } });
    expect(s.streamText).toBe("Hello");
    s = applyCodingStreamEvent(s, {
      event: "content_replace",
      data: { content: "Hi!" },
    });
    expect(s.streamText).toBe("Hi!");
    s = applyCodingStreamEvent(s, {
      event: "display_append",
      data: { item: { type: "message", role: "assistant", content: "Hi!" } },
    });
    expect(s.streamText).toBe("");
    expect(s.display.filter((d) => d.type === "message")).toHaveLength(2);
    s = applyCodingStreamEvent(s, { event: "done", data: {} });
    expect(s.streaming).toBe(false);
  });

  test("display_append tool_block upsert merges by tool_call_id", () => {
    let s = emptyCodingThread();
    s = applyCodingStreamEvent(s, {
      event: "display_append",
      data: {
        item: {
          type: "tool_block",
          calls: [
            {
              name: "file_read",
              argsPreview: "",
              tool_call_id: "c1",
              status: "running",
              args: { path: "a.ts" },
            },
          ],
        },
      },
    });
    s = applyCodingStreamEvent(s, {
      event: "display_append",
      data: {
        item: {
          type: "tool_block",
          calls: [
            {
              name: "file_read",
              argsPreview: "",
              tool_call_id: "c1",
              status: "done",
              result: "ok",
            },
          ],
        },
      },
    });
    expect(s.display).toHaveLength(1);
    const block = s.display[0];
    expect(block?.type).toBe("tool_block");
    if (block?.type === "tool_block") {
      expect(block.calls).toHaveLength(1);
      expect(block.calls[0]?.status).toBe("done");
      expect(block.calls[0]?.result).toBe("ok");
    }
  });

  test("commitStreamTextIfAny 落盘未提交流式文本", () => {
    let s = { ...emptyCodingThread(), streamText: "partial", streaming: true };
    s = commitStreamTextIfAny(s);
    expect(s.streamText).toBe("");
    expect(s.streaming).toBe(false);
    expect(s.display.at(-1)).toEqual({
      type: "message",
      role: "assistant",
      content: "partial",
    });
  });
});
