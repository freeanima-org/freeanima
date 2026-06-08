import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import {
  registerMemoryTools,
  searchSemanticMemory,
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  resetMemorySessionStoreForTests,
  resetSemanticMemoryStoreForTests,
} from "@freeanima/life-memory";
import { registerToolSessionResolver } from "@freeanima/life-memory/tool-session-port";
import { getTool } from "@freeanima/engine-tool";
import { runWithToolContext } from "@freeanima/engine-loop";

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
    async countSessionsByPlatform() {
      return {};
    },
    async deleteDebugSessions() {
      return 0;
    },
    async findSessionIdByPlatformInfo() {
      return null;
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
      return rows.size;
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
      const limit = opts.limit ?? 10;
      return list.slice(0, limit).map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
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
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
    registerSemanticMemoryStore(createMockSemanticStore());
    registerToolSessionResolver(() => "20260527_160000_test");
    registerMemoryTools();
  });

  afterEach(() => {
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
  });

  it("searchSemanticMemory finds semantic memory via port", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    await store.create({ content: "逸灵风使用 TypeScript 实现记忆管道" });

    const results = await searchSemanticMemory("TypeScript", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.includes("TypeScript"))).toBe(true);
    expect(results[0]!.source).toBe("semantic_memory");
  });

  it("remember creates semantic memory with source_sessions", async () => {
    const sid = "20260527_160000_test";
    await runWithToolContext(sid, async () => {
      const out = await getTool("remember")!.handler({
        content: "增量索引探针 beta",
        type: "world",
      });
      expect(out).toContain("semantic_memory_id");
    });
    const results = await searchSemanticMemory("beta", 5);
    expect(results.length).toBe(1);
  });

  it("update_semantic_memory clears source_sessions with empty array", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    const id = await store.create({
      content: "带来源的 memory",
      source_sessions: ["s1", "s2"],
    });
    const out = await getTool("update_semantic_memory")!.handler({
      id,
      source_sessions: [],
    });
    const parsed = JSON.parse(out) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    const row = await store.get(id);
    expect(row?.source_sessions).toEqual([]);
  });

  it("recall returns semantic memory and dialogue hits", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    await store.create({ content: "逸灵风记忆管道使用 compression 压缩" });

    const sid = "20260526_120000_abcd";
    registerMemorySessionStore(
      mockSessionStore({
        async searchMessagesFts() {
          return [
            {
              content: "讨论 compression 算法",
              role: "user",
              session_id: sid,
              timestamp: "2026-05-26T12:00:00+08:00",
              rank: 0.1,
            },
          ];
        },
      }),
    );

    const out = await getTool("recall")!.handler({ query: "compression" });
    const parsed = JSON.parse(out) as {
      semantic_memory: { content: string }[];
      dialogue: { content: string }[];
    };
    expect(parsed.semantic_memory.length).toBeGreaterThan(0);
    expect(parsed.dialogue.length).toBeGreaterThan(0);
    expect(parsed.semantic_memory.some((r) => r.content.includes("compression"))).toBe(true);
    expect(parsed.dialogue.some((r) => r.content.includes("compression"))).toBe(true);
  });
});
