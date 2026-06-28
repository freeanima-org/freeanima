import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type {
  SemanticMemoryStorePort,
  ConversationStorePort,
  SemanticMemoryRow,
} from "@freeanima/core/repos";
import { FtsQueryError } from "@freeanima/core/util";
import {
  registerMemoryTools,
  searchSemanticMemory,
  registerAutobiographicalMemoryStore,
  registerLimbicMemoryStore,
  registerMemoryConversationStore,
  registerSemanticMemoryStore,
  resetAutobiographicalMemoryStoreForTests,
  resetLimbicMemoryStoreForTests,
  resetMemoryConversationStoreForTests,
  resetSemanticMemoryStoreForTests,
} from "@freeanima/capabilities-memory";
import { registerToolConversationResolver } from "@freeanima/capabilities-memory/tool-conversation-port";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { runWithToolContext, getToolConversationId } from "@freeanima/core/tool";

let toolSets: ToolSetRegistry;

function mockConversationStore(overrides: Partial<ConversationStorePort>): ConversationStorePort {
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
    async archiveConversation() {},
    async unarchiveConversation() {},
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

const MOCK_DB_NULLS = {
  content_embedding: null,
  content_fts: null,
  fts_segmented: null,
} as const;

function toMockSemanticRow(
  partial: Partial<SemanticMemoryRow> & Pick<SemanticMemoryRow, "id" | "content">,
): SemanticMemoryRow {
  const now = new Date();
  return {
    type: "world",
    pinned: false,
    source_conversations: [],
    observed_at: now,
    occurred_at: null,
    status: "active",
    reference_count: 0,
    created_at: now,
    updated_at: now,
    ...MOCK_DB_NULLS,
    ...partial,
  };
}

function createMockSemanticStore(): SemanticMemoryStorePort {
  const rows = new Map<string, SemanticMemoryRow>();
  let seq = 0;

  return {
    async create(row) {
      seq += 1;
      const id = row.id ?? `f-${String(seq).padStart(6, "0")}-abcd`;
      const now = new Date();
      rows.set(
        id,
        toMockSemanticRow({
          id,
          type: row.type ?? "world",
          pinned: row.pinned ?? false,
          content: row.content,
          source_conversations: row.source_conversations ?? [],
          observed_at: row.observed_at ? new Date(row.observed_at) : now,
          occurred_at: row.occurred_at ?? null,
          status: row.status ?? "active",
          reference_count: 0,
          created_at: row.created_at ? new Date(row.created_at) : now,
          updated_at: row.updated_at ? new Date(row.updated_at) : now,
        }),
      );
      return id;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async update(row) {
      const existing = rows.get(row.id);
      if (!existing) return;
      rows.set(row.id, {
        ...existing,
        content: row.content ?? existing.content,
        type: row.type ?? existing.type,
        pinned: row.pinned ?? existing.pinned,
        source_conversations:
          row.source_conversations !== undefined
            ? row.source_conversations
            : existing.source_conversations,
        observed_at:
          row.observed_at !== undefined
            ? row.observed_at
              ? new Date(row.observed_at)
              : null
            : existing.observed_at,
        occurred_at: row.occurred_at !== undefined ? row.occurred_at : existing.occurred_at,
        status: row.status ?? existing.status,
        updated_at: new Date(),
      });
    },
    async deprecate(id) {
      const existing = rows.get(id);
      if (!existing) return false;
      rows.set(id, { ...existing, status: "deprecated", updated_at: new Date() });
      return true;
    },
    async delete(id) {
      return rows.delete(id);
    },
    async count() {
      return [...rows.values()].filter((r) => r.status === "active").length;
    },
    async listResident(topN = 20) {
      return [...rows.values()]
        .filter((r) => r.status === "active")
        .toSorted((a, b) => Number(b.pinned) - Number(a.pinned))
        .slice(0, topN);
    },
    async listAll() {
      return [...rows.values()];
    },
    async listActive() {
      return [...rows.values()].filter((r) => r.status === "active");
    },
    async listBySourceConversations(conversationIds, opts) {
      const status = opts?.status ?? "active";
      return [...rows.values()].filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        return r.source_conversations.some((s) => conversationIds.includes(s));
      });
    },
    async searchFts(query, opts) {
      const q = query.toLowerCase();
      const limit = opts?.limit ?? 10;
      return [...rows.values()]
        .filter((r) => r.status === "active" && r.content.toLowerCase().includes(q))
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
    },
    async search(opts) {
      const status = opts.status ?? "active";
      let list = [...rows.values()].filter((r) => status === "all" || r.status === status);
      if (opts.source_conversations?.length) {
        list = list.filter((r) =>
          r.source_conversations.some((s) => opts.source_conversations!.includes(s)),
        );
      }
      if (opts.query) {
        const q = opts.query.toLowerCase();
        list = list.filter((r) => r.content.toLowerCase().includes(q));
      }
      const offset = opts.offset ?? 0;
      const limit = opts.limit ?? 10;
      return list.slice(offset, offset + limit).map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
    },
    async countSearch(opts) {
      const status = opts.status ?? "active";
      let list = [...rows.values()].filter((r) => status === "all" || r.status === status);
      if (opts.source_conversations?.length) {
        list = list.filter((r) =>
          r.source_conversations.some((s) => opts.source_conversations!.includes(s)),
        );
      }
      if (opts.query) {
        const q = opts.query.toLowerCase();
        list = list.filter((r) => r.content.toLowerCase().includes(q));
      }
      return list.length;
    },
    async findByContent(content) {
      const trimmed = content.trim();
      for (const row of rows.values()) {
        if (row.status === "active" && row.content.trim() === trimmed) return row;
      }
      return null;
    },
  };
}

describe("memory search", () => {
  beforeEach(() => {
    toolSets = new ToolSetRegistry();
    resetMemoryConversationStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
    registerSemanticMemoryStore(createMockSemanticStore());
    registerLimbicMemoryStore({
      async create() {
        return "lm-1";
      },
      async get() {
        return null;
      },
      async listByConversation() {
        return [];
      },
      async listByConversations() {
        return [];
      },
      async listByCreatedBetween() {
        return [];
      },
      async list() {
        return [];
      },
      async searchFts() {
        return [];
      },
      async count() {
        return 0;
      },
    });
    registerAutobiographicalMemoryStore({
      async create() {
        return "ab-1";
      },
      async get() {
        return null;
      },
      async deprecate() {
        return false;
      },
      async count() {
        return 0;
      },
      async listActive() {
        return [];
      },
      async listCreatedSince() {
        return [];
      },
      async listBySourceSemanticMemory() {
        return [];
      },
      async listBySourceConversations() {
        return [];
      },
      async list() {
        return [];
      },
      async searchFts() {
        return [];
      },
    });
    registerToolConversationResolver(() => "20260527_160000_test");
    registerMemoryTools(toolSets);
  });

  afterEach(() => {
    resetMemoryConversationStoreForTests();
    resetSemanticMemoryStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
  });

  it("searchSemanticMemory finds semantic memory via port", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    await store.create({ content: "FreeAnima implements the memory pipeline in TypeScript" });

    const results = await searchSemanticMemory("TypeScript", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.includes("TypeScript"))).toBe(true);
    expect(results[0]!.source).toBe("semantic_memory");
  });

  it("remember creates semantic memory with source_conversations", async () => {
    const sid = "20260527_160000_test";
    await runWithToolContext(
      sid,
      async () => {
        const out = await toolSets.getTool("memory_remember")!.handler({
          content: "Incremental index probe beta",
          type: "world",
        });
        expect(out).toContain("semantic_memory_id");
      },
      { tools: toolSets },
    );
    const results = await searchSemanticMemory("beta", 5);
    expect(results.length).toBe(1);
  });

  it("remember in auto_llm context omits source_conversations", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    registerToolConversationResolver(getToolConversationId);
    let createdSources: string[] | undefined;
    const origCreate = store.create.bind(store);
    store.create = async (row) => {
      createdSources = row.source_conversations;
      return origCreate(row);
    };

    await runWithToolContext(
      "autollm_probe",
      async () => {
        await toolSets.getTool("memory_remember")!.handler({
          content: "auto llm memory probe",
          type: "world",
        });
      },
      { tools: toolSets, contextKind: "auto_llm" },
    );
    expect(createdSources).toEqual([]);
  });

  it("memory_semantic_update clears source_conversations with empty array", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    const id = await store.create({
      content: "memory with sources",
      source_conversations: ["s1", "s2"],
    });
    const out = await toolSets.getTool("memory_semantic_update")!.handler({
      id,
      source_conversations: [],
    });
    const parsed = JSON.parse(out) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    const row = await store.get(id);
    expect(row?.source_conversations).toEqual([]);
  });

  it("memory_recall returns unified results with memory_type", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    await store.create({ content: "FreeAnima memory pipeline uses compression" });

    const sid = "20260526_120000_abcd";
    registerMemoryConversationStore(
      mockConversationStore({
        async searchMessagesFts() {
          return [
            {
              message_id: "msg-001",
              content: "Discussing compression algorithms",
              role: "user",
              conversation_id: sid,
              timestamp: "2026-05-26T12:00:00+08:00",
              rank: 0.1,
            },
          ];
        },
      }),
    );

    const out = await toolSets.getTool("memory_recall")!.handler({ query: "compression" });
    const parsed = JSON.parse(out) as {
      results: Array<{ memory_type: string; snippet?: string; content?: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    const semantic = parsed.results.find((r) => r.memory_type === "semantic");
    const conversation = parsed.results.find((r) => r.memory_type === "conversation");
    expect(semantic?.content?.includes("compression")).toBe(true);
    expect(conversation?.snippet?.includes("compression")).toBe(true);
    expect(conversation && "content" in conversation).toBe(false);
  });

  it("memory_recall returns friendly FTS validation error", async () => {
    registerSemanticMemoryStore(createMockSemanticStore());

    const out = await toolSets.getTool("memory_recall")!.handler({ query: "退烧 OR" });
    expect(out).toContain("修改建议");
    expect(out).toContain("不能以 OR 结尾");
  });

  it("memory_recall propagates store FTS errors as toolError", async () => {
    const store = createMockSemanticStore();
    store.searchFts = async () => {
      throw new FtsQueryError(
        "invalid_tsquery_structure",
        "检索词之间缺少 AND/OR 连接",
        "空格默认 AND",
      );
    };
    registerSemanticMemoryStore(store);

    const out = await toolSets.getTool("memory_recall")!.handler({ query: "退烧 OR 注意力" });
    expect(out).toContain("修改建议");
    expect(out).toContain("缺少 AND/OR 连接");
  });
});
