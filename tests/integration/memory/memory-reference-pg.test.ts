import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import {
  appendMessage,
  deleteConversation,
  upsertConversationMeta,
} from "@freeanima/host/core/db/pg/conversation";
import {
  countReferencesBySemanticMemory,
  formatMemoryReferenceMarker,
  syncAllReferenceCounts,
} from "@freeanima/host/core/db/pg/memory-reference";
import {
  createSemanticMemory,
  deprecateSemanticMemory,
  getSemanticMemory,
  listResidentSemanticMemory,
} from "@freeanima/host/core/db/pg/semantic-memory";

async function seedSessionMeta(conversationId: string): Promise<void> {
  await upsertConversationMeta(conversationId, {
    model: "test-model",
    cached_toolsets: [],
    functions: [],
    timestamp: new Date().toISOString(),
    platform: "test",
  });
}

describePg("memory_references PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-memref-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("message references write, conversation dedup count, and full sync", async () => {
    const memoryId = await createSemanticMemory({
      content: "reference count probe memory",
      type: "world",
    });

    const conversationId = "memref-session-1";
    await seedSessionMeta(conversationId);

    const marker = formatMemoryReferenceMarker(memoryId);
    await appendMessage(conversationId, {
      role: "assistant",
      content: `See ${marker} for details`,
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await appendMessage(conversationId, {
      role: "assistant",
      content: `Again ${marker}`,
      pos: 2,
      timestamp: new Date().toISOString(),
    });

    let row = await getSemanticMemory(memoryId);
    // 每条消息计一次 × 近 30 天权重 2；同 conversation 不去重
    expect(row?.reference_count).toBe(4);
    expect(await countReferencesBySemanticMemory(memoryId)).toBe(2);

    const sync = await syncAllReferenceCounts();
    expect(sync.updated).toBe(1);
    row = await getSemanticMemory(memoryId);
    expect(row?.reference_count).toBe(4);
  });

  it("listResident returns pinned + reference-count top N", async () => {
    const pinnedId = await createSemanticMemory({ content: "pinned memory", pinned: true });
    const hotId = await createSemanticMemory({ content: "hot memory" });
    await createSemanticMemory({ content: "cold memory" });

    const conversationId = "memref-resident";
    await seedSessionMeta(conversationId);
    await appendMessage(conversationId, {
      role: "assistant",
      content: formatMemoryReferenceMarker(hotId),
      pos: 1,
    });

    const resident = await listResidentSemanticMemory(10);
    const ids = resident.map((r) => r.id);
    expect(ids).toContain(pinnedId);
    expect(ids).toContain(hotId);
    expect(resident.find((r) => r.id === pinnedId)?.pinned).toBe(true);
    expect((await getSemanticMemory(hotId))?.reference_count).toBe(2);
  });

  it("listResident caps pinned at RESIDENT_PINNED_MAX", async () => {
    const { RESIDENT_PINNED_MAX } =
      await import("@freeanima/host/core/db/pg/semantic-memory/types");

    for (let i = 0; i < RESIDENT_PINNED_MAX + 2; i++) {
      await createSemanticMemory({
        content: `pinned cap probe ${i}`,
        pinned: true,
      });
    }

    const resident = await listResidentSemanticMemory(RESIDENT_PINNED_MAX);
    expect(resident.length).toBe(RESIDENT_PINNED_MAX);
    expect(resident.every((r) => r.pinned)).toBe(true);
  });

  it("deprecate clears pinned flag", async () => {
    const id = await createSemanticMemory({
      content: "pinned then deprecated",
      pinned: true,
    });
    expect((await getSemanticMemory(id))?.pinned).toBe(true);

    const ok = await deprecateSemanticMemory(id);
    expect(ok).toBe(true);
    expect((await getSemanticMemory(id))?.pinned).toBe(false);
    expect((await getSemanticMemory(id))?.status).toBe("deprecated");
  });

  it("session delete invalidates references and full sync zeroes counts", async () => {
    const memoryId = await createSemanticMemory({ content: "session reference pending delete" });
    const conversationId = "memref-delete";
    await seedSessionMeta(conversationId);
    await appendMessage(conversationId, {
      role: "user",
      content: formatMemoryReferenceMarker(memoryId),
      pos: 1,
    });

    expect((await getSemanticMemory(memoryId))?.reference_count).toBe(2);

    await deleteConversation(conversationId);
    await syncAllReferenceCounts();

    expect(await countReferencesBySemanticMemory(memoryId)).toBe(0);
    expect((await getSemanticMemory(memoryId))?.reference_count).toBe(0);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
