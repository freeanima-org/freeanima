import { buildMessagesDisplay, paginateMessagesDisplay } from "./build-messages-display.ts";
import { describe, expect, it } from "bun:test";

import type { StoredMessage } from "@freeanima/habitat/core/db/domain";

describe("buildMessagesDisplay", () => {
  it("aggregates assistant tool_calls and tool results into tool_block", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "check the weather" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "web_search", arguments: '{"query":"Beijing weather"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"temp": 25}' },
      { role: "assistant", content: "Beijing is 25°C today" },
    ];

    const display = buildMessagesDisplay(msgs);
    expect(display).toHaveLength(3);
    expect(display[0]).toEqual({ type: "message", role: "user", content: "check the weather" });
    const toolBlock = display[1];
    expect(toolBlock?.type).toBe("tool_block");
    if (toolBlock?.type === "tool_block") {
      expect(toolBlock.calls).toHaveLength(1);
      expect(toolBlock.calls[0]?.name).toBe("web_search");
      expect(toolBlock.calls[0]?.args).toEqual({ query: "Beijing weather" });
      expect(toolBlock.calls[0]?.result).toBe('{"temp": 25}');
      expect(toolBlock.calls[0]?.status).toBe("done");
    }
    expect(display[2]).toEqual({
      type: "message",
      role: "assistant",
      content: "Beijing is 25°C today",
    });
  });

  it("paginated return with total/offset/limit", () => {
    const msgs: StoredMessage[] = Array.from({ length: 5 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));
    const page = paginateMessagesDisplay("sess", msgs, { offset: 2, limit: 2 });
    expect(page.total).toBe(5);
    expect(page.offset).toBe(2);
    expect(page.limit).toBe(2);
    expect(page.display).toHaveLength(2);
    expect(page.display[0]).toMatchObject({ content: "msg 2" });
  });

  it("returns all when no limit", () => {
    const msgs: StoredMessage[] = [{ role: "user", content: "a" }];
    const all = paginateMessagesDisplay("sess", msgs);
    expect(all.limit).toBeNull();
    expect(all.display).toHaveLength(1);
  });

  it("emits separate tool_blocks when assistant text separates rounds", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "go" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "read", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "ok" },
      {
        role: "assistant",
        content: "mid",
      },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "grep", arguments: '{"p":"a"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_2", content: "hit" },
      { role: "assistant", content: "done" },
    ];

    const display = buildMessagesDisplay(msgs);
    const toolBlocks = display.filter((d) => d.type === "tool_block");
    expect(toolBlocks).toHaveLength(2);
    if (toolBlocks[0]?.type === "tool_block") {
      expect(toolBlocks[0].calls[0]?.name).toBe("read");
    }
    if (toolBlocks[1]?.type === "tool_block") {
      expect(toolBlocks[1].calls[0]?.name).toBe("grep");
    }
    expect(display.some((d) => d.type === "message" && d.content === "mid")).toBe(true);
  });

  it("merges consecutive tool rounds without intervening assistant text", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "go" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "read", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "ok" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "grep", arguments: '{"p":"a"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_2", content: "hit" },
      { role: "assistant", content: "done" },
    ];

    const display = buildMessagesDisplay(msgs);
    const toolBlocks = display.filter((d) => d.type === "tool_block");
    expect(toolBlocks).toHaveLength(1);
    if (toolBlocks[0]?.type === "tool_block") {
      expect(toolBlocks[0].calls.map((c) => c.name)).toEqual(["read", "grep"]);
      expect(toolBlocks[0].calls.every((c) => c.status === "done")).toBe(true);
    }
  });

  it("embeds image_generate object_file as anima URI in assistant content", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "画一只猫" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "img1",
            type: "function",
            function: { name: "image_generate", arguments: '{"prompt":"cat"}' },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "img1",
        content: JSON.stringify({
          object_file_id: 42,
          title: "cat.png",
          mime_type: "image/png",
          size: 100,
        }),
      },
      { role: "assistant", content: "画好了" },
    ];
    const display = buildMessagesDisplay(msgs);
    const assistant = display.find((d) => d.type === "message" && d.role === "assistant");
    expect(assistant?.type).toBe("message");
    if (assistant?.type === "message") {
      expect(assistant.content).toBe("画好了\n\n[[anima:42]]");
      expect(assistant.attachments).toBeUndefined();
    }
  });

  it("embeds voice_generate object_file as anima URI in assistant content", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "念一段" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "v1",
            type: "function",
            function: { name: "voice_generate", arguments: '{"text":"你好"}' },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "v1",
        content: JSON.stringify({
          object_file_id: 99,
          title: "speech.mp3",
          mime_type: "audio/mpeg",
          size: 200,
        }),
      },
      { role: "assistant", content: "已生成" },
    ];
    const display = buildMessagesDisplay(msgs);
    const assistant = display.find((d) => d.type === "message" && d.role === "assistant");
    expect(assistant?.type).toBe("message");
    if (assistant?.type === "message") {
      expect(assistant.content).toBe("已生成\n\n[[anima:99]]");
    }
  });

  it("synthesizes assistant bubble with anima URI when tool ends without text", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "画" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "img1",
            type: "function",
            function: { name: "image_generate", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "img1",
        content: JSON.stringify({ object_file_id: 7, mime_type: "image/png", size: 1 }),
      },
    ];
    const display = buildMessagesDisplay(msgs);
    const assistant = display.find((d) => d.type === "message" && d.role === "assistant");
    expect(assistant?.type).toBe("message");
    if (assistant?.type === "message") {
      expect(assistant.content).toBe("[[anima:7]]");
    }
  });

  it("projects source message pos onto display messages", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "hi", pos: 10 },
      { role: "assistant", content: "hello", pos: 11 },
    ];
    const display = buildMessagesDisplay(msgs);
    expect(display).toEqual([
      { type: "message", role: "user", content: "hi", pos: 10 },
      { type: "message", role: "assistant", content: "hello", pos: 11 },
    ]);
  });
});
