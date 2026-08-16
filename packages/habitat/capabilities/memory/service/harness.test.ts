/**
 * MemoryService harness（无 Habitat UI）：仅依赖可注入 deps 的 embedded 服务。
 * 完整 LoCoMo 刷榜见风巢 #16041。
 */
import { describe, expect, test } from "bun:test";

import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/pg/semantic-memory/types";

import { createEmbeddedMemoryService, createRemoteMemoryService } from "./index.ts";

function row(
  partial: Partial<SemanticMemoryRow> & Pick<SemanticMemoryRow, "id" | "content">,
): SemanticMemoryRow {
  const now = new Date();
  return {
    type: "world",
    pinned: false,
    source_conversations: ["c"],
    source: { conversation_id: "c", message_ids: ["1"] },
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

describe("MemoryService harness (no Habitat UI)", () => {
  test("灌对话式 remember → get → list 闭环", async () => {
    const store = new Map<number, SemanticMemoryRow>();
    let seq = 1;
    const svc = createEmbeddedMemoryService({
      deps: {
        createSemanticMemory: async (input) => {
          const id = seq++;
          store.set(
            id,
            row({
              id,
              content: input.content,
              source: input.source ?? null,
              source_conversations: input.source_conversations ?? [],
            }),
          );
          return id;
        },
        getSemanticMemory: async (id) => store.get(Number(id)) ?? null,
        listActiveSemanticMemory: async () => [...store.values()],
        listResidentSemanticMemory: async () => [...store.values()].filter((r) => r.pinned),
        updateSemanticMemory: async () => {},
        deprecateSemanticMemory: async () => true,
        getMessageTextItemsByIds: async () => [],
        bumpReferenceCountsFromTexts: async () => [],
        watermarkStore: {
          get: async () => null,
          set: async () => {},
        },
      },
    });

    const created = await svc.remember({
      content: "Alice lives in Shanghai",
      kind: "world",
      source: { conversation_id: "conv-eval", message_ids: ["m1"] },
    });
    expect(created.id).toBe(1);
    expect(await svc.get(1)).toMatchObject({ content: "Alice lives in Shanghai" });
    expect(await svc.list()).toHaveLength(1);
  });

  test("remote client posts to baseUrl", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const svc = createRemoteMemoryService({
      baseUrl: "http://memory.test/rpc",
      fetch: (async (url, init) => {
        let href: string;
        if (typeof url === "string") href = url;
        else if (url instanceof URL) href = url.href;
        else if (typeof Request !== "undefined" && url instanceof Request) href = url.url;
        else href = "http://memory.test/rpc/unknown";
        const rawBody =
          typeof init?.body === "string"
            ? init.body
            : init?.body == null
              ? "{}"
              : JSON.stringify(init.body);
        calls.push({ url: href, body: JSON.parse(rawBody) });
        return new Response(JSON.stringify({ hits: [] }), { status: 200 });
      }) as typeof fetch,
    });
    expect(svc.deployment).toBe("remote");
    await svc.recall({ query: "hi", scope: "semantic" });
    expect(calls[0]?.url).toBe("http://memory.test/rpc/recall");
    expect(calls[0]?.body).toMatchObject({ query: "hi", scope: "semantic" });
  });
});
