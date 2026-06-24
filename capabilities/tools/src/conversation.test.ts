import { describe, expect, it } from "bun:test";
import type { ConversationStorePort } from "@freeanima/core/repos";
import { nullPgRepositories } from "@freeanima/core/repos";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { runWithToolContext } from "@freeanima/core/tool";
import { FtsQueryError } from "@freeanima/core/util";
import { registerConversationTools } from "./conversation.ts";

function createMockConversationStore(
  overrides: Partial<ConversationStorePort> = {},
): ConversationStorePort {
  const base: ConversationStorePort = {
    async getConversationMeta() {
      return null;
    },
    async getConversationMetaLite() {
      return null;
    },
    async getConversationTools() {
      return [];
    },
    async upsertConversationMeta() {},
    async patchConversationMeta() {},
    async updateCompression() {},
    async updateTodos() {},
    async appendMessage() {
      throw new Error("not implemented");
    },
    async appendMessageReturningId() {
      throw new Error("not implemented");
    },
    async updateMessageContent() {},
    async getMessageContentById() {
      return null;
    },
    async getMessageContentsByIds() {
      return {};
    },
    async nextMessagePos() {
      return 1;
    },
    async listMessages() {
      return [];
    },
    async listMessagesByPosRange() {
      return [];
    },
    async listMessagesPage() {
      return [];
    },
    async countMessages() {
      return 0;
    },
    async countUserMessages() {
      return 0;
    },
    async findMessagePos() {
      return null;
    },
    async listMessageRowsPage() {
      return [];
    },
    async listMessageRowsFromPos() {
      return [];
    },
    async lastMessageTimestamp() {
      return null;
    },
    async truncateMessagesAfter() {},
    async shiftMessagePositions() {},
    async conversationExists() {
      return false;
    },
    async deleteConversation() {},
    async listConversationIds() {
      return [];
    },
    async listDebugConversationIds() {
      return [];
    },
    async listConversationSummaries() {
      return [];
    },
    async listConversationSummariesPage() {
      return { items: [], total: 0 };
    },
    async countConversationsByPlatform() {
      return {};
    },
    async deleteDebugConversations() {
      return 0;
    },
    async findConversationIdByPlatformInfo() {
      return null;
    },
    async listConversationIdsMatchingPlatformProbe() {
      return [];
    },
    async searchMessagesFts() {
      return [];
    },
    async countSearchableMessages() {
      return 0;
    },
    async listConversationIdsUpdatedBetween() {
      return [];
    },
    async getEarliestConversationDay() {
      return null;
    },
    async listStaleConversationIdsForCleanup() {
      return [];
    },
    async deleteStaleConversations() {
      return { deleted: 0, ids: [] };
    },
  };
  return { ...base, ...overrides };
}

function reposWithSession(conversation: ConversationStorePort) {
  return { ...nullPgRepositories, conversation };
}

describe("registerConversationTools", () => {
  it("conversation_search returns FTS hits", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_search");
    expect(def).toBeDefined();

    const conversation = createMockConversationStore({
      async searchMessagesFts() {
        return [
          {
            message_id: "m1",
            conversation_id: "s1",
            role: "user",
            content: "hello world",
            timestamp: "2026-01-01T00:00:00+08:00",
            rank: 0.5,
          },
        ];
      },
    });

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
      { tools: toolSets, repos: reposWithSession(conversation) },
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
      { tools: toolSets, repos: reposWithSession(createMockConversationStore()) },
    );
  });

  it("conversation_search returns friendly FTS validation error", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_search")!;

    const conversation = createMockConversationStore({
      async searchMessagesFts() {
        throw new FtsQueryError(
          "trailing_operator",
          "query 不能以 OR 结尾",
          "示例：退烧 OR 注意力",
        );
      },
    });

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ query: "hello" });
        expect(raw).toContain("修改建议");
        expect(raw).toContain("不能以 OR 结尾");
      },
      { tools: toolSets, repos: reposWithSession(conversation) },
    );
  });

  it("conversation_scroll paginates by offset", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_scroll")!;

    const conversation = createMockConversationStore({
      async conversationExists(id: string) {
        return id === "s1";
      },
      async countMessages() {
        return 5;
      },
      async listMessageRowsPage(_sid, offset, limit) {
        return [
          {
            message_id: "m2",
            pos: offset + 2,
            role: "assistant",
            content: "reply",
            timestamp: "2026-01-01T00:00:01+08:00",
          },
        ].slice(0, limit);
      },
    });

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
      { tools: toolSets, repos: reposWithSession(conversation) },
    );
  });

  it("conversation_scroll anchors by message_id", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_scroll")!;

    const conversation = createMockConversationStore({
      async conversationExists() {
        return true;
      },
      async countMessages() {
        return 3;
      },
      async findMessagePos(_sid, messageId) {
        return messageId === "anchor" ? 2 : null;
      },
      async listMessageRowsFromPos(_sid, fromPos, limit) {
        return [
          {
            message_id: "anchor",
            pos: fromPos,
            role: "user",
            content: "anchor text",
            timestamp: "2026-01-01T00:00:00+08:00",
          },
        ].slice(0, limit);
      },
    });

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
      { tools: toolSets, repos: reposWithSession(conversation) },
    );
  });

  it("conversation_scroll returns error when conversation missing", async () => {
    const toolSets = new ToolSetRegistry();
    registerConversationTools(toolSets);
    const def = toolSets.getTool("conversation_scroll")!;

    await runWithToolContext(
      "sess-1",
      async () => {
        const raw = await def.handler({ conversation_id: "missing" });
        expect(raw).toContain('"error"');
        expect(raw).toContain("not found");
      },
      { tools: toolSets, repos: reposWithSession(createMockConversationStore()) },
    );
  });
});
