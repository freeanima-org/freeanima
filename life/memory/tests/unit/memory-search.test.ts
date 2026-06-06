import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SessionStorePort } from "@freeanima/engine-repos";
import {
  resetStoreForTests,
  registerMemoryTools,
  MemoryStore,
  indexL3Fact,
  searchL3,
  searchL3Fts,
  indexL3Facts,
  registerMemorySessionStore,
  resetMemorySessionStoreForTests,
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

describe("memory search", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-search-"));
    process.env.FREEANIMA_HOME = home;
    resetStoreForTests();
    resetMemorySessionStoreForTests();
    registerMemoryTools();
  });

  afterEach(() => {
    resetMemorySessionStoreForTests();
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("FTS finds indexed L3 fact", async () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "逸灵风使用 TypeScript 实现记忆管道",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    const fact = store.get(id);
    expect(fact).toBeTruthy();
    indexL3Fact(fact!);

    const results = searchL3("TypeScript", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.includes("TypeScript"))).toBe(true);
    expect(results[0]!.source).toBe("l3");
  });

  it("remember indexes only the new fact", async () => {
    const store = new MemoryStore(join(home, "memory"));
    store.create({
      content: "占位事实 alpha",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    const sid = "20260527_160000_test";
    await runWithToolContext(sid, async () => {
      await getTool("remember")!.handler({
        content: "增量索引探针 beta",
        confidence: 0.9,
        importance: 0.9,
        recall: 0.5,
      });
    });
    expect(searchL3Fts("beta", 5).length).toBe(1);
    expect(searchL3Fts("alpha", 5).length).toBe(0);
  });

  it("indexL3Facts indexes batch by id", async () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "批量索引 gamma",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    expect(indexL3Facts([id])).toBe(1);
    expect(searchL3Fts("gamma", 5).length).toBe(1);
  });

  it("recall returns L3 facts and PG dialogue hits", async () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "逸灵风记忆管道使用 compression 压缩",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    indexL3Fact(store.get(id)!);

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
    expect(out).toContain("## L3 事实");
    expect(out).toContain("## 历史对话");
    expect(out).toContain("compression");
  });
});
