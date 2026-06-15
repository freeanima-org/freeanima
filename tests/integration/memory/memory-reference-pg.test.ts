import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";

async function seedSessionMeta(sessionId: string): Promise<void> {
  await getTestEngine().repos.session.upsertSessionMeta(sessionId, {
    role: "session_meta",
    model: "test-model",
    tools: [],
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

  it("message references write, session dedup count, and full sync", async () => {
    const { semanticMemory, memoryReference, session } = getTestEngine().repos;

    const memoryId = await semanticMemory.create({
      content: "reference count probe memory",
      type: "world",
    });

    const sessionId = "memref-session-1";
    await seedSessionMeta(sessionId);

    await session.appendMessage(sessionId, {
      role: "assistant",
      content: `See [[${memoryId}]] for details`,
      pos: 1,
      timestamp: "2026-06-09T12:00:00+08:00",
    });
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: `Again [[${memoryId}]]`,
      pos: 2,
      timestamp: "2026-06-09T12:01:00+08:00",
    });

    let row = await semanticMemory.get(memoryId);
    expect(row?.reference_count).toBe(2);
    expect(await memoryReference.countBySemanticMemory(memoryId)).toBe(2);

    const sync = await memoryReference.syncAllReferenceCounts();
    expect(sync.updated).toBe(1);
    row = await semanticMemory.get(memoryId);
    expect(row?.reference_count).toBe(2);
  });

  it("listResident returns pinned + reference-count top N", async () => {
    const { semanticMemory, session } = getTestEngine().repos;

    const pinnedId = await semanticMemory.create({ content: "pinned memory", pinned: true });
    const hotId = await semanticMemory.create({ content: "hot memory" });
    await semanticMemory.create({ content: "cold memory" });

    const sessionId = "memref-resident";
    await seedSessionMeta(sessionId);
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: `[[${hotId}]]`,
      pos: 1,
    });

    const resident = await semanticMemory.listResident(10);
    const ids = resident.map((r) => r.id);
    expect(ids).toContain(pinnedId);
    expect(ids).toContain(hotId);
    expect(resident.find((r) => r.id === pinnedId)?.pinned).toBe(true);
    expect((await semanticMemory.get(hotId))?.reference_count).toBe(2);
  });

  it("listResident caps pinned at RESIDENT_PINNED_MAX", async () => {
    const { semanticMemory } = getTestEngine().repos;
    const { RESIDENT_PINNED_MAX } = await import("@freeanima/core/repos");

    for (let i = 0; i < RESIDENT_PINNED_MAX + 2; i++) {
      await semanticMemory.create({
        content: `pinned cap probe ${i}`,
        pinned: true,
      });
    }

    const resident = await semanticMemory.listResident(RESIDENT_PINNED_MAX);
    expect(resident.length).toBe(RESIDENT_PINNED_MAX);
    expect(resident.every((r) => r.pinned)).toBe(true);
  });

  it("deprecate clears pinned flag", async () => {
    const { semanticMemory } = getTestEngine().repos;

    const id = await semanticMemory.create({
      content: "pinned then deprecated",
      pinned: true,
    });
    expect((await semanticMemory.get(id))?.pinned).toBe(true);

    const ok = await semanticMemory.deprecate(id);
    expect(ok).toBe(true);
    expect((await semanticMemory.get(id))?.pinned).toBe(false);
    expect((await semanticMemory.get(id))?.status).toBe("deprecated");
  });

  it("session delete invalidates references and full sync zeroes counts", async () => {
    const { semanticMemory, memoryReference, session } = getTestEngine().repos;

    const memoryId = await semanticMemory.create({ content: "session reference pending delete" });
    const sessionId = "memref-delete";
    await seedSessionMeta(sessionId);
    await session.appendMessage(sessionId, {
      role: "user",
      content: `[[${memoryId}]]`,
      pos: 1,
    });

    expect((await semanticMemory.get(memoryId))?.reference_count).toBe(2);

    await session.deleteSession(sessionId);
    await memoryReference.syncAllReferenceCounts();

    expect(await memoryReference.countBySemanticMemory(memoryId)).toBe(0);
    expect((await semanticMemory.get(memoryId))?.reference_count).toBe(0);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
