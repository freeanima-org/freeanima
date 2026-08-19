import { describe, expect, test } from "bun:test";

import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/pg/semantic-memory/types";

import {
  createEmbeddedMemoryService,
  provenanceFromSourceConversations,
  semanticRowToMemoryRecord,
} from "./index.ts";

function row(
  partial: Partial<SemanticMemoryRow> & Pick<SemanticMemoryRow, "id" | "content">,
): SemanticMemoryRow {
  const now = new Date("2026-08-01T00:00:00Z");
  return {
    type: "world",
    pinned: false,
    source_conversations: ["conv-1"],
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

describe("MemoryService embedded shell", () => {
  test("deployment is embedded", () => {
    const svc = createEmbeddedMemoryService({
      deps: {
        getSemanticMemory: async () => null,
        listActiveSemanticMemory: async () => [],
        listResidentSemanticMemory: async () => [],
        updateSemanticMemory: async () => {},
      },
    });
    expect(svc.deployment).toBe("embedded");
  });

  test("get / list / pin / unpin / listResident / assembleResidentBlock", async () => {
    const store = new Map<number, SemanticMemoryRow>([
      [1, row({ id: 1, content: "Alice lives in Shanghai", pinned: true, reference_count: 3 })],
      [2, row({ id: 2, content: "Prefer concise replies", type: "preference", pinned: false })],
    ]);

    const svc = createEmbeddedMemoryService({
      deps: {
        getSemanticMemory: async (id) => store.get(Number(id)) ?? null,
        listActiveSemanticMemory: async () => [...store.values()],
        listResidentSemanticMemory: async (topN) =>
          [...store.values()].filter((r) => r.pinned).slice(0, topN ?? 20),
        updateSemanticMemory: async (input) => {
          const cur = store.get(Number(input.id));
          if (!cur) return;
          store.set(cur.id, { ...cur, pinned: input.pinned ?? cur.pinned });
        },
      },
    });

    expect(await svc.get(1)).toMatchObject({
      id: 1,
      content: "Alice lives in Shanghai",
      kind: "world",
      pinned: true,
      source: { conversation_id: "conv-1" },
    });
    expect(await svc.get(99)).toBeNull();

    const listed = await svc.list({ kinds: ["preference"] });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(2);

    await svc.pin(2);
    expect(store.get(2)?.pinned).toBe(true);
    await svc.unpin(2);
    expect(store.get(2)?.pinned).toBe(false);

    const resident = await svc.listResident();
    expect(resident.map((r) => r.id)).toEqual([1]);

    const block = await svc.assembleResidentBlock();
    expect(block).toContain('<memory id="1"');
    expect(block).toContain("Alice lives in Shanghai");
    expect(block).not.toContain("[[anima:1]]");
  });

  test("unimplemented methods removed — recall uses search when available", async () => {
    const svc = createEmbeddedMemoryService({
      deps: {
        getSemanticMemory: async () => null,
        listActiveSemanticMemory: async () => [],
        listResidentSemanticMemory: async () => [],
        updateSemanticMemory: async () => {},
      },
    });
    // search without query falls back to list (empty)
    expect(await svc.search({ limit: 5 })).toEqual([]);
  });

  test("provenanceFromSourceConversations + semanticRowToMemoryRecord", () => {
    expect(provenanceFromSourceConversations([])).toBeNull();
    expect(provenanceFromSourceConversations(["  a  ", "b"])).toEqual({ conversation_id: "a" });
    const rec = semanticRowToMemoryRecord(row({ id: 7, content: "x", source_conversations: [] }));
    expect(rec.source).toBeNull();
    expect(rec.links).toEqual([]);
  });
});
