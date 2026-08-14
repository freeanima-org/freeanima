import { describe, expect, test, beforeEach, afterEach } from "bun:test";

import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/pg/semantic-memory/types";

import {
  createEmbeddedMemoryService,
  createRetainWatermarkStore,
  registerRetainEngine,
  resetRetainEngineForTests,
  type RetainWatermarkStore,
} from "./index.ts";

function row(
  partial: Partial<SemanticMemoryRow> & Pick<SemanticMemoryRow, "id" | "content">,
): SemanticMemoryRow {
  const now = new Date("2026-08-01T00:00:00Z");
  return {
    type: "world",
    pinned: false,
    source_conversations: ["conv-1"],
    source: { conversation_id: "conv-1" },
    links: [],
    observed_at: now,
    occurred_at: null,
    status: "active",
    reference_count: 0,
    created_at: now,
    updated_at: now,
    world_id: 1,
    ...partial,
  };
}

function memoryWatermarkStore(): RetainWatermarkStore {
  const map = new Map<string, { message_id: string; at: string }>();
  return {
    async get(id) {
      return map.get(id) ?? null;
    },
    async set(id, wm) {
      map.set(id, wm);
    },
  };
}

describe("MemoryService retain / syncTurn / cite", () => {
  beforeEach(() => {
    resetRetainEngineForTests();
  });
  afterEach(() => {
    resetRetainEngineForTests();
  });

  test("remember requires provenance", async () => {
    const svc = createEmbeddedMemoryService({
      deps: {
        createSemanticMemory: async () => 1,
        getSemanticMemory: async () => row({ id: 1, content: "x" }),
        listActiveSemanticMemory: async () => [],
        listResidentSemanticMemory: async () => [],
        updateSemanticMemory: async () => {},
        deprecateSemanticMemory: async () => true,
        getMessageContentsByIds: async () => ({}),
        bumpReferenceCountsFromTexts: async () => [],
        watermarkStore: memoryWatermarkStore(),
      },
    });
    await expect(svc.remember({ content: "x", source: { conversation_id: "" } })).rejects.toThrow(
      /provenance/,
    );
  });

  test("retain is idempotent via watermark", async () => {
    const created: string[] = [];
    registerRetainEngine(async () => ({
      items: [{ content: "fact from turn", kind: "world" }],
    }));

    let nextId = 10;
    const store = new Map<number, SemanticMemoryRow>();
    const wm = memoryWatermarkStore();

    const svc = createEmbeddedMemoryService({
      deps: {
        createSemanticMemory: async (input) => {
          created.push(input.content);
          const id = nextId++;
          store.set(id, row({ id, content: input.content, source: input.source ?? null }));
          return id;
        },
        getSemanticMemory: async (id) => store.get(Number(id)) ?? null,
        listActiveSemanticMemory: async () => [...store.values()],
        listResidentSemanticMemory: async () => [],
        updateSemanticMemory: async () => {},
        deprecateSemanticMemory: async () => true,
        getMessageContentsByIds: async () => ({ m1: "hello", m2: "world [[anima:1]]" }),
        bumpReferenceCountsFromTexts: async () => [1],
        watermarkStore: wm,
      },
    });

    const first = await svc.retain({
      conversation_id: "c1",
      message_ids: ["m1", "m2"],
    });
    expect(first.skipped).toBe(false);
    expect(first.created).toHaveLength(1);
    expect(created).toHaveLength(1);

    const second = await svc.retain({
      conversation_id: "c1",
      message_ids: ["m1", "m2"],
    });
    expect(second.skipped).toBe(true);
    expect(created).toHaveLength(1);

    const forced = await svc.retain({
      conversation_id: "c1",
      message_ids: ["m1", "m2"],
      force: true,
    });
    expect(forced.skipped).toBe(false);
    expect(created).toHaveLength(2);
  });

  test("cite bumps via injected deps", async () => {
    const bumped: string[][] = [];
    const svc = createEmbeddedMemoryService({
      deps: {
        getSemanticMemory: async () => null,
        listActiveSemanticMemory: async () => [],
        listResidentSemanticMemory: async () => [],
        updateSemanticMemory: async () => {},
        createSemanticMemory: async () => 1,
        deprecateSemanticMemory: async () => true,
        getMessageContentsByIds: async () => ({}),
        bumpReferenceCountsFromTexts: async (texts) => {
          bumped.push(texts);
          return [42];
        },
        watermarkStore: memoryWatermarkStore(),
      },
    });
    const r = await svc.cite({ texts: ["see [[anima:42]]"] });
    expect(r.cited_ids).toEqual([42]);
    expect(bumped[0]?.[0]).toContain("[[anima:42]]");
  });

  test("syncTurn cites and schedules retain", async () => {
    let retainCalls = 0;
    registerRetainEngine(async () => {
      retainCalls += 1;
      return { items: [] };
    });
    const svc = createEmbeddedMemoryService({
      deps: {
        getSemanticMemory: async () => null,
        listActiveSemanticMemory: async () => [],
        listResidentSemanticMemory: async () => [],
        updateSemanticMemory: async () => {},
        createSemanticMemory: async () => 1,
        deprecateSemanticMemory: async () => true,
        getMessageContentsByIds: async () => ({ a: "x" }),
        bumpReferenceCountsFromTexts: async () => [7],
        watermarkStore: memoryWatermarkStore(),
      },
    });
    const out = await svc.syncTurn({
      conversation_id: "c9",
      message_ids: ["a"],
      texts: ["[[anima:7]]"],
    });
    expect(out.cited_ids).toEqual([7]);
    expect(out.retain_scheduled).toBe(true);
    await Bun.sleep(20);
    expect(retainCalls).toBe(1);
  });

  test("createRetainWatermarkStore file fallback roundtrip", async () => {
    const path = `/tmp/memory-retain-wm-${Date.now()}.json`;
    const store = createRetainWatermarkStore(path);
    await store.set("c", { message_id: "m", at: "2026-08-14T00:00:00+08:00" });
    expect(await store.get("c")).toEqual({
      message_id: "m",
      at: "2026-08-14T00:00:00+08:00",
    });
  });
});
