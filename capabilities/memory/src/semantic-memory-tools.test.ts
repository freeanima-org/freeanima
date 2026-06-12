import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { SemanticMemoryStorePort } from "@freeanima/storage-repos";
import type { SemanticMemoryCreateInput } from "@freeanima/storage-repos";

import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "./semantic-port.ts";
import { createSemanticMemoryFromArgs, semanticMemoryToolDefs } from "./semantic-memory-tools.ts";

function createMockSemanticStore(): SemanticMemoryStorePort & {
  created: SemanticMemoryCreateInput[];
} {
  const created: SemanticMemoryCreateInput[] = [];
  return {
    created,
    create: async (row: SemanticMemoryCreateInput) => {
      created.push(row);
      return "f-new-id";
    },
    get: async (id: string) => {
      if (id === "f-a") {
        return {
          id: "f-a",
          content: "A",
          type: "world",
          pinned: false,
          reference_count: 0,
          source_sessions: ["s-1"],
          observed_at: "2026-03-01T10:00:00+08:00",
          occurred_at: "2025 Spring",
          status: "active",
          created: "",
          updated: "",
        };
      }
      if (id === "f-b") {
        return {
          id: "f-b",
          content: "B",
          type: "world",
          pinned: false,
          reference_count: 0,
          source_sessions: ["s-2"],
          observed_at: "2026-04-01T10:00:00+08:00",
          occurred_at: "2024 Winter",
          status: "active",
          created: "",
          updated: "",
        };
      }
      return null;
    },
    deprecate: async () => true,
  } as unknown as SemanticMemoryStorePort & { created: SemanticMemoryCreateInput[] };
}

describe("createSemanticMemoryFromArgs observed_at", () => {
  let store: ReturnType<typeof createMockSemanticStore>;

  beforeEach(() => {
    store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("prefers args.observed_at when provided", async () => {
    await createSemanticMemoryFromArgs(
      { content: "test", observed_at: "2026-01-15T08:00:00+08:00" },
      { observed_at: "2026-02-01T00:00:00+08:00" },
    );
    expect(store.created[0]?.observed_at).toBe("2026-01-15T08:00:00+08:00");
  });

  it("uses defaults when args.observed_at is absent", async () => {
    await createSemanticMemoryFromArgs(
      { content: "test" },
      { observed_at: "2026-02-01T00:00:00+08:00" },
    );
    expect(store.created[0]?.observed_at).toBe("2026-02-01T00:00:00+08:00");
  });
});

describe("memory_semantic_merge occurred_at", () => {
  let store: ReturnType<typeof createMockSemanticStore>;

  beforeEach(() => {
    store = createMockSemanticStore();
    registerSemanticMemoryStore(store);
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("merge picks earliest non-empty occurred_at from source memories", async () => {
    const mergeDef = semanticMemoryToolDefs.find((d) => d.name === "memory_semantic_merge");
    expect(mergeDef).toBeDefined();

    const raw = await mergeDef!.handler({
      source_ids: ["f-a", "f-b"],
      target_content: "merged content",
    });
    const parsed = JSON.parse(raw) as {
      merged_occurred_at: string | null;
      id: string;
    };

    expect(parsed.merged_occurred_at).toBe("2024 Winter");
    expect(store.created[0]?.occurred_at).toBe("2024 Winter");
  });

  it("target_occurred_at overrides programmatic merge", async () => {
    const mergeDef = semanticMemoryToolDefs.find((d) => d.name === "memory_semantic_merge");
    const raw = await mergeDef!.handler({
      source_ids: ["f-a", "f-b"],
      target_content: "merged content",
      target_occurred_at: "2026 Summer",
    });
    const parsed = JSON.parse(raw) as { merged_occurred_at: string | null };
    expect(parsed.merged_occurred_at).toBe("2026 Summer");
    expect(store.created[0]?.occurred_at).toBe("2026 Summer");
  });
});
