import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from "bun:test";
import * as pg from "@freeanima/host/core/db/pg";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { runWithToolContext } from "@freeanima/host/core/tool";
import { FtsQueryError } from "@freeanima/host/core/util";

const searchMessagesFtsMock = mock(async (..._args: unknown[]) => [] as never);
const conversationExistsMock = mock(async (..._args: unknown[]) => false);
const countMessagesMock = mock(async (..._args: unknown[]) => 0);
const findMessagePosMock = mock(async (..._args: unknown[]) => null as number | null);
const listMessageRowsPageMock = mock(async (..._args: unknown[]) => [] as never);
const listMessageRowsFromPosMock = mock(async (..._args: unknown[]) => [] as never);

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  searchMessagesFts: searchMessagesFtsMock,
  conversationExists: conversationExistsMock,
  countMessages: countMessagesMock,
  findMessagePos: findMessagePosMock,
  listMessageRowsPage: listMessageRowsPageMock,
  listMessageRowsFromPos: listMessageRowsFromPosMock,
}));

import { registerConversationTools } from "./conversation.ts";

describe("registerConversationTools", () => {
  let pgSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    pgSpy = spyOn(pg, "isPostgresPrimary").mockReturnValue(true);
    searchMessagesFtsMock.mockClear();
    conversationExistsMock.mockClear();
    countMessagesMock.mockClear();
    findMessagePosMock.mockClear();
    listMessageRowsPageMock.mockClear();
    listMessageRowsFromPosMock.mockClear();
  });

  afterEach(() => {
    pgSpy.mockRestore();
  });

  it("conversation_search returns FTS hits", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_search");
    expect(def).toBeDefined();

    searchMessagesFtsMock.mockImplementation((async () => [
      {
        message_id: "m1",
        conversation_id: "s1",
        role: "user",
        content: "hello world",
        timestamp: "2026-01-01T00:00:00+08:00",
        rank: 0.5,
      },
    ]) as never);

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def!.handler({ query: "hello" });
        const parsed = JSON.parse(raw) as {
          hits: { message_id: string; snippet: string; content?: string }[];
        };
        expect(parsed.hits).toHaveLength(1);
        expect(parsed.hits[0]!.message_id).toBe("m1");
        expect(parsed.hits[0]!.snippet).toContain("hello");
        expect(parsed.hits[0]!.content).toBeUndefined();
      },
      { tools: toolSets },
    );
  });

  it("conversation_search returns error when query missing", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_search")!;

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ query: "  " });
        expect(raw).toContain('"error"');
      },
      { tools: toolSets },
    );
  });

  it("conversation_search returns friendly FTS validation error", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_search")!;

    searchMessagesFtsMock.mockImplementation(async () => {
      throw new FtsQueryError("trailing_operator", "query 不能以 OR 结尾", "示例：退烧 OR 注意力");
    });

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ query: "hello" });
        expect(raw).toContain("修改建议");
        expect(raw).toContain("不能以 OR 结尾");
      },
      { tools: toolSets },
    );
  });

  it("conversation_scroll paginates by offset", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_scroll")!;

    conversationExistsMock.mockImplementation((async (id: string) => id === "s1") as never);
    countMessagesMock.mockImplementation(async () => 5);
    listMessageRowsPageMock.mockImplementation((async (
      _sid: string,
      offset: number,
      limit: number,
    ) =>
      [
        {
          message_id: "m2",
          pos: offset + 2,
          role: "assistant",
          content: "reply",
          timestamp: "2026-01-01T00:00:01+08:00",
        },
      ].slice(0, limit)) as never);

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ conversation_id: "s1", offset: 1, limit: 10 });
        const parsed = JSON.parse(raw) as {
          conversation_id: string;
          messages: { message_id: string; content: string }[];
          total: number;
          offset: number;
        };
        expect(parsed.conversation_id).toBe("s1");
        expect(parsed.total).toBe(5);
        expect(parsed.offset).toBe(1);
        expect(parsed.messages[0]!.message_id).toBe("m2");
      },
      { tools: toolSets },
    );
  });

  it("conversation_scroll anchors by message_id", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_scroll")!;

    conversationExistsMock.mockImplementation(async () => true);
    countMessagesMock.mockImplementation(async () => 3);
    findMessagePosMock.mockImplementation((async (_sid: string, messageId: string) =>
      messageId === "anchor" ? 2 : null) as never);
    listMessageRowsFromPosMock.mockImplementation((async (
      _sid: string,
      fromPos: number,
      limit: number,
    ) =>
      [
        {
          message_id: "anchor",
          pos: fromPos,
          role: "user",
          content: "anchor text",
          timestamp: "2026-01-01T00:00:00+08:00",
        },
      ].slice(0, limit)) as never);

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ conversation_id: "s1", message_id: "anchor" });
        const parsed = JSON.parse(raw) as {
          messages: { message_id: string; content: string }[];
          offset: number;
        };
        expect(parsed.messages[0]!.message_id).toBe("anchor");
        expect(parsed.offset).toBe(1);
      },
      { tools: toolSets },
    );
  });

  it("conversation_scroll returns error when conversation missing", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_scroll")!;

    conversationExistsMock.mockImplementation(async () => false);

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ conversation_id: "missing" });
        expect(raw).toContain('"error"');
        expect(raw).toContain("session not found");
      },
      { tools: toolSets },
    );
  });
});
