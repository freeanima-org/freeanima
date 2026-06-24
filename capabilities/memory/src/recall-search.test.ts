import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type {
  AutobiographicalMemoryStorePort,
  LimbicMemoryStorePort,
  SemanticMemoryStorePort,
  SessionStorePort,
} from "@freeanima/core/repos";
import {
  registerAutobiographicalMemoryStore,
  registerLimbicMemoryStore,
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  resetAutobiographicalMemoryStoreForTests,
  resetLimbicMemoryStoreForTests,
  resetMemorySessionStoreForTests,
  resetSemanticMemoryStoreForTests,
} from "./index.ts";
import { memoryRecallSearch } from "./recall-search.ts";

function mockSessionStore(overrides: Partial<SessionStorePort> = {}): SessionStorePort {
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

type MockSemanticRow = {
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

function createMockSemanticStore(rows: MockSemanticRow[]): SemanticMemoryStorePort {
  const map = new Map(rows.map((r) => [r.id, r]));
  return {
    async create() {
      return "new";
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async update() {},
    async deprecate() {
      return false;
    },
    async delete() {
      return false;
    },
    async count() {
      return [...map.values()].filter((r) => r.status === "active").length;
    },
    async listResident() {
      return [...map.values()];
    },
    async listAll() {
      return [...map.values()];
    },
    async listActive() {
      return [...map.values()].filter((r) => r.status === "active");
    },
    async listBySourceSessions() {
      return [];
    },
    async searchFts(query, opts) {
      const q = query.toLowerCase();
      const limit = opts?.limit ?? 10;
      return [...map.values()]
        .filter((r) => r.status === "active" && r.content.toLowerCase().includes(q))
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
    },
    async search() {
      return [];
    },
    async countSearch() {
      return 0;
    },
    async findByContent() {
      return null;
    },
  };
}

function createMockLimbicStore(
  rows: Array<{
    id: string;
    session_id: string;
    kind: "spike";
    content: string;
    intensity: number;
    valence: number | null;
    arousal: number | null;
    source_segment: string | null;
    semantic_memory_ids: string[];
    created: string;
  }>,
): LimbicMemoryStorePort {
  return {
    async create() {
      return "lm-new";
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
    async listByCreatedBetween() {
      return [];
    },
    async list(opts) {
      const q = opts?.query?.toLowerCase() ?? "";
      const limit = opts?.limit ?? 20;
      return rows.filter((r) => !q || r.content.toLowerCase().includes(q)).slice(0, limit);
    },
    async count() {
      return rows.length;
    },
    async searchFts(query, opts) {
      const q = query.toLowerCase();
      const limit = opts?.limit ?? 20;
      return rows
        .filter((r) => !q || r.content.toLowerCase().includes(q))
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
    },
  };
}

function createMockAutobiographicalStore(
  rows: Array<{
    id: string;
    title: string;
    content: string;
    significance: "normal";
    period_start: string | null;
    period_end: string | null;
    source_semantic_memory: string[];
    source_sessions: string[];
    status: "active";
    created: string;
    updated: string;
  }>,
): AutobiographicalMemoryStorePort {
  return {
    async create() {
      return "ab-new";
    },
    async get() {
      return null;
    },
    async deprecate() {
      return false;
    },
    async count() {
      return rows.length;
    },
    async listActive() {
      return rows;
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
    async list(opts) {
      const q = opts?.query?.toLowerCase() ?? "";
      const limit = opts?.limit ?? 20;
      const status = opts?.status ?? "active";
      return rows
        .filter(
          (r) =>
            r.status === status &&
            (!q || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)),
        )
        .slice(0, limit);
    },
    async searchFts(query, opts) {
      const q = query.toLowerCase();
      const limit = opts?.limit ?? 20;
      const status = opts?.status ?? "active";
      return rows
        .filter(
          (r) =>
            r.status === status &&
            (!q || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)),
        )
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
    },
  };
}

describe("memoryRecallSearch", () => {
  beforeEach(() => {
    resetSemanticMemoryStoreForTests();
    resetMemorySessionStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
    resetMemorySessionStoreForTests();
    resetLimbicMemoryStoreForTests();
    resetAutobiographicalMemoryStoreForTests();
  });

  it("merges four sources and returns unified results with memory_type", async () => {
    const now = "2026-05-26T12:00:00+08:00";
    registerSemanticMemoryStore(
      createMockSemanticStore([
        {
          id: "f-000001-abcd",
          type: "world",
          pinned: false,
          content: "compression semantic probe",
          source_sessions: ["sid"],
          observed_at: now,
          occurred_at: null,
          status: "active",
          reference_count: 0,
          created: now,
          updated: now,
        },
      ]),
    );
    registerMemorySessionStore(
      mockSessionStore({
        async searchMessagesFts() {
          return [
            {
              message_id: "msg-001",
              session_id: "sid",
              role: "user",
              content:
                "prefix padding text before the important compression session message appears here with much more suffix padding text",
              timestamp: now,
              rank: 0.2,
            },
          ];
        },
      }),
    );
    registerLimbicMemoryStore(
      createMockLimbicStore([
        {
          id: "lm-1",
          session_id: "sid",
          kind: "spike",
          content: "compression limbic feeling",
          intensity: 0.8,
          valence: -0.2,
          arousal: 0.6,
          source_segment: "mid",
          semantic_memory_ids: [],
          created: now,
        },
      ]),
    );
    registerAutobiographicalMemoryStore(
      createMockAutobiographicalStore([
        {
          id: "ab-1",
          title: "compression milestone",
          content: "long autobiographical compression narrative",
          significance: "normal",
          period_start: null,
          period_end: null,
          source_semantic_memory: [],
          source_sessions: ["sid"],
          status: "active",
          created: now,
          updated: now,
        },
      ]),
    );

    const out = await memoryRecallSearch("compression", { limit: 10 });
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.length).toBeLessThanOrEqual(10);
    const types = new Set(out.results.map((r) => r.memory_type));
    expect(types.has("semantic")).toBe(true);
    expect(types.has("session")).toBe(true);
    expect(types.has("limbic")).toBe(true);
    expect(types.has("autobiographical")).toBe(true);

    const sessionHit = out.results.find((r) => r.memory_type === "session");
    expect(sessionHit).toBeDefined();
    if (sessionHit?.memory_type === "session") {
      expect(sessionHit.snippet).toContain("compression");
      expect(sessionHit.snippet.length).toBeLessThan(
        "prefix padding text before the important compression session message appears here with much more suffix padding text"
          .length,
      );
    }
  });

  it("respects limit cap", async () => {
    const now = "2026-05-26T12:00:00+08:00";
    const semanticRows: MockSemanticRow[] = [];
    for (let i = 0; i < 12; i += 1) {
      semanticRows.push({
        id: `f-${String(i).padStart(6, "0")}-abcd`,
        type: "world",
        pinned: false,
        content: `compression item ${i}`,
        source_sessions: [],
        observed_at: now,
        occurred_at: null,
        status: "active",
        reference_count: 0,
        created: now,
        updated: now,
      });
    }
    registerSemanticMemoryStore(createMockSemanticStore(semanticRows));
    registerMemorySessionStore(mockSessionStore());
    registerLimbicMemoryStore(createMockLimbicStore([]));
    registerAutobiographicalMemoryStore(createMockAutobiographicalStore([]));

    const out = await memoryRecallSearch("compression", { limit: 5 });
    expect(out.limit).toBe(5);
    expect(out.results.length).toBe(5);
  });
});
