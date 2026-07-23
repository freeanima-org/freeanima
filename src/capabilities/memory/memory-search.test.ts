import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import type { MessageFtsHit } from "@freeanima/core/db/pg/conversation/types";
import type { SemanticMemoryCreateInput } from "@freeanima/core/db/pg/semantic-memory/types";
import type { SemanticMemoryRow } from "@freeanima/core/db/schema/rows";
import { FtsQueryError } from "@freeanima/core/util";
import { registerMemoryTools, searchSemanticMemory } from "@freeanima/capabilities/memory";
import { registerToolConversationResolver } from "@freeanima/capabilities/memory/tool-conversation-port";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { runWithToolContext, getToolConversationId } from "@freeanima/core/tool";

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

mock.module("@freeanima/core/db/pg/semantic-memory", () => ({
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

const searchMessagesFtsMock = mock(async (..._args: unknown[]) => [] as MessageFtsHit[]);

mock.module("@freeanima/core/db/pg/conversation", () => ({
  searchMessagesFts: searchMessagesFtsMock,
}));

mock.module("@freeanima/core/db/pg/limbic-memory", () => ({
  searchLimbicMemoryFts: mock(async () => []),
}));

mock.module("@freeanima/core/db/pg/autobiographical-memory", () => ({
  searchAutobiographicalMemoryFts: mock(async () => []),
}));

let toolSets: ToolSetRegistry;

describe("memory search", () => {
  beforeEach(() => {
    rows.clear();
    nextId = 1;
    createSemanticMemoryMock.mockClear();
    searchSemanticMemoryFtsMock.mockClear();
    searchMessagesFtsMock.mockClear();
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
      { tools: toolSets },
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
      { tools: toolSets, contextKind: "auto_llm" },
    );
    expect(createdSources).toEqual([]);
  });

  it("memory_semantic_update clears source_conversations with empty array", async () => {
    const id = await createSemanticMemoryMock({
      content: "memory with sources",
      source_conversations: ["s1", "s2"],
    });
    const out = await toolSets.getTool("memory_semantic_update")!.handler({
      id,
      source_conversations: [],
    });
    const parsed = JSON.parse(out) as { ok: boolean };
    expect(parsed.ok).toBe(true);
    const row = await getSemanticMemoryMock(id);
    expect(row?.source_conversations).toEqual([]);
  });

  it("memory_recall returns unified results with memory_type", async () => {
    await createSemanticMemoryMock({ content: "FreeAnima memory pipeline uses compression" });

    const sid = "20260526_120000_abcd";
    searchMessagesFtsMock.mockImplementation(async () => [
      {
        message_id: "msg-001",
        content: "Discussing compression algorithms",
        role: "user",
        conversation_id: sid,
        timestamp: "2026-05-26T12:00:00+08:00",
        rank: 0.1,
      },
    ]);

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

  it("memory_recall memory_types filters sources", async () => {
    await createSemanticMemoryMock({ content: "FreeAnima memory pipeline uses compression" });
    searchMessagesFtsMock.mockImplementation(async () => [
      {
        message_id: "msg-001",
        content: "Discussing compression algorithms",
        role: "user",
        conversation_id: "20260526_120000_abcd",
        timestamp: "2026-05-26T12:00:00+08:00",
        rank: 0.1,
      },
    ]);

    const out = await toolSets.getTool("memory_recall")!.handler({
      query: "compression",
      memory_types: ["semantic"],
    });
    const parsed = JSON.parse(out) as {
      results: Array<{ memory_type: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.every((r) => r.memory_type === "semantic")).toBe(true);
    expect(searchMessagesFtsMock).not.toHaveBeenCalled();
  });

  it("memory_recall returns friendly FTS validation error", async () => {
    const out = await toolSets.getTool("memory_recall")!.handler({ query: "退烧 OR" });
    expect(out).toContain("修改建议");
    expect(out).toContain("不能以 OR 结尾");
  });

  it("memory_recall propagates store FTS errors as toolError", async () => {
    searchSemanticMemoryFtsMock.mockImplementation(async () => {
      throw new FtsQueryError(
        "invalid_tsquery_structure",
        "检索词之间缺少 AND/OR 连接",
        "空格默认 AND",
      );
    });

    const out = await toolSets.getTool("memory_recall")!.handler({ query: "退烧 OR 注意力" });
    expect(out).toContain("修改建议");
    expect(out).toContain("缺少 AND/OR 连接");
  });
});
