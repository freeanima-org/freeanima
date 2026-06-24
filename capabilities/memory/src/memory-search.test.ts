import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/core/repos";
import { FtsQueryError } from "@freeanima/core/util";
import {
  registerMemoryTools,
  searchSemanticMemory,
  registerAutobiographicalMemoryStore,
  registerLimbicMemoryStore,
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  resetAutobiographicalMemoryStoreForTests,
  resetLimbicMemoryStoreForTests,
  resetMemorySessionStoreForTests,
  resetSemanticMemoryStoreForTests,
} from "@freeanima/capabilities-memory";
import { registerToolSessionResolver } from "@freeanima/capabilities-memory/tool-session-port";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { runWithToolContext, getToolSessionId } from "@freeanima/core/tool";

let toolSets: ToolSetRegistry;

function mockSessionStore(overrides: Partial<SessionStorePort>): SessionStorePort {
  const base: SessionStorePort = {
    async getSessionMeta() {
      return null;
    },
    async getSessionMetaLite() {
      return null;
    },
    async getSessionTools() {
      return [];
    },
    async upsertSessionMeta() {},
    async patchSessionMeta() {},
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
    async sessionExists() {
      return false;
    },
    async deleteSession() {},
    async listSessionIds() {
      return [];
    },
    async listDebugSessionIds() {
      return [];
    },
    async listSessionSummaries() {
      return [];
    },
    async listSessionSummariesPage() {
      return { items: [], total: 0 };
    },
    async countSessionsByPlatform() {
      return {};
    },
    async deleteDebugSessions() {
      return 0;
    },
    async findSessionIdByPlatformInfo() {
      return null;
    },
    async listSessionIdsMatchingPlatformProbe() {
      return [];
    },
    async searchMessagesFts() {
      return [];
    },
    async countSearchableMessages() {
      return 0;
    },
    async listSessionIdsUpdatedBetween() {
      return [];
    },
    async getEarliestSessionDay() {
      return null;
    },
    async listStaleSessionIdsForCleanup() {
      return [];
    },
    async deleteStaleSessions() {
      return { deleted: 0, ids: [] };
    },
  };
  return { ...base, ...overrides };
}

type MockRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions: string[];
  observed_at: string | null;
  occurred_at: string | null;
  status: string;
  reference_count: number;
  created: string;
  updated: string;
};

function createMockSemanticStore(): SemanticMemoryStorePort {
  const rows = new Map<string, MockRow>();
  let seq = 0;

  return {
    async create(row) {
      seq += 1;
      const id = row.id ?? `f-${String(seq).padStart(6, "0")}-abcd`;
      const now = new Date().toISOString();
      rows.set(id, {
        id,
        type: row.type ?? "world",
        pinned: row.pinned ?? false,
        content: row.content,
        source_sessions: row.source_sessions ?? [],
        observed_at: row.observed_at ?? now,
        occurred_at: row.occurred_at ?? null,
        status: row.status ?? "active",
        reference_count: 0,
        created: row.created ?? now,
        updated: row.updated ?? now,
      });
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
        source_sessions:
          row.source_sessions !== undefined ? row.source_sessions : existing.source_sessions,
        observed_at: row.observed_at !== undefined ? row.observed_at : existing.observed_at,
        occurred_at: row.occurred_at !== undefined ? row.occurred_at : existing.occurred_at,
        status: row.status ?? existing.status,
        updated: new Date().toISOString(),
      });
    },
    async deprecate(id) {
      const existing = rows.get(id);
      if (!existing) return false;
      rows.set(id, { ...existing, status: "deprecated", updated: new Date().toISOString() });
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
    async listBySourceSessions(sessionIds, opts) {
      const status = opts?.status ?? "active";
      return [...rows.values()].filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        return r.source_sessions.some((s) => sessionIds.includes(s));
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
      if (opts.source_sessions?.length) {
        list = list.filter((r) => r.source_sessions.some((s) => opts.source_sessions!.includes(s)));
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
      if (opts.source_sessions?.length) {
        list = list.filter((r) => r.source_sessions.some((s) => opts.source_sessions!.includes(s)));
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
    resetMemorySessionStoreForTests();
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
      async listBySession() {
        return [];
      },
      async listBySessions() {
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
      async listBySourceSessions() {
        return [];
      },
      async list() {
        return [];
      },
      async searchFts() {
        return [];
      },
    });
    registerToolSessionResolver(() => "20260527_160000_test");
    registerMemoryTools(toolSets);
  });

  afterEach(() => {
    resetMemorySessionStoreForTests();
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

  it("remember creates semantic memory with source_sessions", async () => {
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

  it("remember in auto_llm context omits source_sessions", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    registerToolSessionResolver(getToolSessionId);
    let createdSources: string[] | undefined;
    const origCreate = store.create.bind(store);
    store.create = async (row) => {
      createdSources = row.source_sessions;
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

  it("memory_semantic_update clears source_sessions with empty array", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    const id = await store.create({
      content: "memory with sources",
      source_sessions: ["s1", "s2"],
    });
    const out = await toolSets.getTool("memory_semantic_update")!.handler({
      id,
      source_sessions: [],
    });
    const parsed = JSON.parse(out) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    const row = await store.get(id);
    expect(row?.source_sessions).toEqual([]);
  });

  it("memory_recall returns unified results with memory_type", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    await store.create({ content: "FreeAnima memory pipeline uses compression" });

    const sid = "20260526_120000_abcd";
    registerMemorySessionStore(
      mockSessionStore({
        async searchMessagesFts() {
          return [
            {
              message_id: "msg-001",
              content: "Discussing compression algorithms",
              role: "user",
              session_id: sid,
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
    const session = parsed.results.find((r) => r.memory_type === "session");
    expect(semantic?.content?.includes("compression")).toBe(true);
    expect(session?.snippet?.includes("compression")).toBe(true);
    expect(session && "content" in session).toBe(false);
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
