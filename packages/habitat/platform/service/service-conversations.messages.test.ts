import { afterAll, describe, expect, it, mock } from "bun:test";

import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { emptyLlmUsageTotals } from "@freeanima/shared/llm-usage";
import type { RuntimeDeps } from "./runtime-deps.ts";

const realConversation = await import("@freeanima/habitat/core/db/pg/conversation");
const conversationOriginal = { ...realConversation };

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  ...conversationOriginal,
  sumConversationUsage: mock(async () => emptyLlmUsageTotals()),
  sumConversationUsageBetween: mock(async () => emptyLlmUsageTotals()),
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/conversation", () => conversationOriginal);
});

const { getMessages } = await import("./service-conversations.ts");

function msg(pos: number, role: "user" | "assistant" | "tool", content: string): StoredMessage {
  if (role === "tool") {
    return { role: "tool", tool_call_id: `c${pos}`, content, pos };
  }
  return { role, content, pos };
}

function makeDeps(all: StoredMessage[]): RuntimeDeps {
  const loadMessagePage = mock(async (_id: string, offset: number, limit: number) =>
    all.slice(offset, offset + limit),
  );
  const loadMessagesBeforePos = mock(async (_id: string, beforePos: number, limit: number) => {
    const before = all.filter((m) => typeof m.pos === "number" && m.pos < beforePos);
    return before.slice(Math.max(0, before.length - limit));
  });
  return {
    conversation: {
      conversationExists: mock(async () => true),
      assertConversationPlatform: mock(async () => undefined),
      countMessages: mock(async () => all.length),
      loadMessagePage,
      loadMessagesBeforePos,
    },
  } as unknown as RuntimeDeps;
}

describe("getMessages pagination", () => {
  const all: StoredMessage[] = Array.from({ length: 10 }, (_, i) =>
    msg(i + 1, "user", `m${i + 1}`),
  );

  it("tail page when offset and before_pos omitted", async () => {
    const deps = makeDeps(all);
    const page = await getMessages(deps, "c1", "", { limit: 3 });
    expect(page.display).toHaveLength(3);
    expect(page.display[0]).toMatchObject({ content: "m8" });
    expect(page.display[2]).toMatchObject({ content: "m10" });
    expect(page.from_pos).toBe(8);
    expect(page.to_pos).toBe(10);
    expect(page.has_more_before).toBe(true);
    expect(page.total).toBe(10);
    expect(page.offset).toBe(7);
    expect(page.usage).toEqual(emptyLlmUsageTotals());
  });

  it("offset path keeps Habitat head pagination", async () => {
    const deps = makeDeps(all);
    const page = await getMessages(deps, "c1", "", { offset: 0, limit: 3 });
    expect(page.display[0]).toMatchObject({ content: "m1" });
    expect(page.display[2]).toMatchObject({ content: "m3" });
    expect(page.offset).toBe(0);
    expect(page.from_pos).toBe(1);
    expect(page.has_more_before).toBe(false);
  });

  it("before_pos loads older window", async () => {
    const deps = makeDeps(all);
    const page = await getMessages(deps, "c1", "", { before_pos: 8, limit: 3 });
    expect(page.display).toHaveLength(3);
    expect(page.display[0]).toMatchObject({ content: "m5" });
    expect(page.display[2]).toMatchObject({ content: "m7" });
    expect(page.from_pos).toBe(5);
    expect(page.to_pos).toBe(7);
    expect(page.has_more_before).toBe(true);
    expect(page.context).toBeUndefined();
  });

  it("expands leading orphan tool rows", async () => {
    const withTools: StoredMessage[] = [
      msg(1, "user", "go"),
      {
        role: "assistant",
        content: null,
        pos: 2,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "read", arguments: "{}" },
          },
        ],
      },
      msg(3, "tool", "ok"),
      msg(4, "assistant", "done"),
    ];
    const deps = makeDeps(withTools);
    // 尾页 limit=2 会切到 tool+assistant；扩窗应带上 assistant tool_calls
    const page = await getMessages(deps, "c1", "", { limit: 2 });
    expect(page.from_pos).toBe(2);
    expect(page.display.some((d) => d.type === "tool_block")).toBe(true);
    expect(page.display.some((d) => d.type === "message" && d.content === "done")).toBe(true);
  });
});
