import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import {
  registerMemoryTools,
  searchL3,
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  resetMemorySessionStoreForTests,
  resetSemanticMemoryStoreForTests,
} from "@freeanima/life-memory";
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
  };
  return { ...base, ...overrides };
}

function createMockSemanticStore(): SemanticMemoryStorePort {
  const rows = new Map<
    string,
    {
      id: string;
      type: string;
      pinned: boolean;
      content: string;
      created: string;
      updated: string;
    }
  >();
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
        updated: new Date().toISOString(),
      });
    },
    async delete(id) {
      return rows.delete(id);
    },
    async count() {
      return rows.size;
    },
    async listResident(topN = 20) {
      return [...rows.values()]
        .toSorted((a, b) => Number(b.pinned) - Number(a.pinned))
        .slice(0, topN);
    },
    async listAll() {
      return [...rows.values()];
    },
    async searchFts(query, opts) {
      const q = query.toLowerCase();
      const limit = opts?.limit ?? 10;
      return [...rows.values()]
        .filter((r) => r.content.toLowerCase().includes(q))
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
    },
    async findByContent(content) {
      const trimmed = content.trim();
      for (const row of rows.values()) {
        if (row.content.trim() === trimmed) return row;
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
    registerMemoryTools();
  });

  afterEach(() => {
    resetMemorySessionStoreForTests();
    resetSemanticMemoryStoreForTests();
  });

  it("searchL3 finds semantic memory via port", async () => {
    const store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
    await store.create({ content: "逸灵风使用 TypeScript 实现记忆管道" });

    const results = await searchL3("TypeScript", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.includes("TypeScript"))).toBe(true);
    expect(results[0]!.source).toBe("l3");
  });

  it("remember creates semantic memory", async () => {
    const sid = "20260527_160000_test";
    await runWithToolContext(sid, async () => {
      const out = await getTool("remember")!.handler({
        content: "增量索引探针 beta",
        type: "world",
      });
      expect(out).toContain("fact_id");
    });
    const results = await searchL3("beta", 5);
    expect(results.length).toBe(1);
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
    expect(out).toContain("## 语义记忆");
    expect(out).toContain("## 历史对话");
    expect(out).toContain("compression");
  });
});
