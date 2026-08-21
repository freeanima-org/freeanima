import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import type { SemanticMemoryCreateInput } from "@freeanima/habitat/core/db/pg/semantic-memory/types";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { registerMemoryTools, searchSemanticMemory } from "@freeanima/habitat/capabilities/memory";
import { registerToolConversationResolver } from "@freeanima/habitat/capabilities/memory/tool-conversation-port";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { runWithToolContext, getToolConversationId } from "@freeanima/habitat/core/tool";

mock.module("@freeanima/habitat/core/config/world-context-pg.ts", () => ({
  resolvePrivateWorldId: mock(async () => 1),
}));

const rows = new Map<number, SemanticMemoryRow>();
let nextId = 1;

function rowFromCreate(input: SemanticMemoryCreateInput, id: number): SemanticMemoryRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    content: input.content.trim(),
    type: input.type ?? "world",
    pinned: input.pinned ?? false,
    reference_count: 0,
    source_conversations: input.source_conversations ?? [],
    observed_at: input.observed_at ? new Date(input.observed_at) : null,
    occurred_at: input.occurred_at ?? null,
    status: "active",
    world_id: 1,
    created_at: now,
    updated_at: now,
  };
}

const createSemanticMemoryMock = mock(async (input: SemanticMemoryCreateInput) => {
  const id = nextId++;
  rows.set(id, rowFromCreate(input, id));
  return id;
});

const getSemanticMemoryMock = mock(async (id: string | number) => {
  const n = typeof id === "number" ? id : Number(id);
  return rows.get(n) ?? null;
});

const updateSemanticMemoryMock = mock(
  async (input: { id: string | number; source_conversations?: string[] }) => {
    const n = typeof input.id === "number" ? input.id : Number(input.id);
    const row = rows.get(n);
    if (!row) return null;
    if (input.source_conversations !== undefined) {
      row.source_conversations = input.source_conversations;
    }
    return row;
  },
);

const searchSemanticMemoryFtsMock = mock(async (query: string) => {
  const q = query.toLowerCase();
  return [...rows.values()]
    .filter((r) => r.status === "active" && r.content.toLowerCase().includes(q))
    .map((r, i) => ({ ...r, rank: 1 / (i + 1) }));
});

mock.module("@freeanima/habitat/core/db/pg/semantic-memory", () => ({
  createSemanticMemory: createSemanticMemoryMock,
  getSemanticMemory: getSemanticMemoryMock,
  updateSemanticMemory: updateSemanticMemoryMock,
  deleteSemanticMemory: mock(async () => true),
  deprecateSemanticMemory: mock(async () => true),
  searchSemanticMemoryFts: searchSemanticMemoryFtsMock,
  searchSemanticMemory: mock(async () => []),
  countSemanticMemorySearch: mock(async () => 0),
  listResidentSemanticMemory: mock(async () => []),
  findSemanticMemoryByContent: mock(async () => null),
  countSemanticMemory: mock(async () => rows.size),
}));

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  searchMessagesFts: mock(async () => []),
}));

mock.module("@freeanima/habitat/core/db/pg/limbic-memory", () => ({
  searchLimbicMemoryFts: mock(async () => []),
}));

mock.module("@freeanima/habitat/core/db/pg/autobiographical-memory", () => ({
  searchAutobiographicalMemoryFts: mock(async () => []),
}));

let toolSets: ToolSetRegistry;

describe("memory search", () => {
  beforeEach(() => {
    rows.clear();
    nextId = 1;
    createSemanticMemoryMock.mockClear();
    searchSemanticMemoryFtsMock.mockClear();
    toolSets = new ToolSetRegistry();
    registerToolConversationResolver(() => "20260527_160000_test");
    registerMemoryTools(toolSets);
  });

  afterEach(() => {
    rows.clear();
  });

  it("searchSemanticMemory finds semantic memory via PG FTS", async () => {
    await createSemanticMemoryMock({
      content: "FreeAnima implements the memory pipeline in TypeScript",
    });

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
      { tools: toolSets, subjectId: 1 },
    );
    const results = await searchSemanticMemory("beta", 5);
    expect(results.length).toBe(1);
  });

  it("remember in auto_llm context omits source_conversations", async () => {
    registerToolConversationResolver(getToolConversationId);
    let createdSources: string[] | undefined;
    createSemanticMemoryMock.mockImplementation(async (input) => {
      createdSources = input.source_conversations;
      const id = nextId++;
      rows.set(id, rowFromCreate(input, id));
      return id;
    });

    await runWithToolContext(
      "autollm_probe",
      async () => {
        await toolSets.getTool("memory_remember")!.handler({
          content: "auto llm memory probe",
          type: "world",
        });
      },
      { tools: toolSets, contextKind: "auto_llm", subjectId: 1 },
    );
    expect(createdSources).toEqual([]);
  });

  it("memory_semantic_update clears source_conversations with empty array", async () => {
    const id = await createSemanticMemoryMock({
      content: "memory with sources",
      source_conversations: ["s1", "s2"],
    });
    const out = await runWithToolContext(
      "upd",
      () =>
        toolSets.getTool("memory_semantic_update")!.handler({
          id,
          source_conversations: [],
        }),
      { tools: toolSets, subjectId: 1 },
    );
    const parsed = JSON.parse(out) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    const row = await getSemanticMemoryMock(id);
    expect(row?.source_conversations).toEqual([]);
  });

  it("does not register retired memory_recall tool", () => {
    expect(toolSets.getTool("memory_recall")).toBeUndefined();
  });
});
