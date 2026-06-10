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

  it("消息引用写入、session 去重计数与全量同步", async () => {
    const { semanticMemory, memoryReference, session } = getTestEngine().repos;

    const memoryId = await semanticMemory.create({
      content: "引用计数探针记忆",
      type: "world",
    });

    const sessionId = "memref-session-1";
    await seedSessionMeta(sessionId);

    await session.appendMessage(sessionId, {
      role: "assistant",
      content: `参考 [记忆 #${memoryId}] 的内容`,
      pos: 1,
      timestamp: "2026-06-09T12:00:00+08:00",
    });
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: `再次引用 [记忆 #${memoryId}]`,
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

  it("listResident 返回 pinned + 引用计数 top N", async () => {
    const { semanticMemory, session } = getTestEngine().repos;

    const pinnedId = await semanticMemory.create({ content: "置顶记忆", pinned: true });
    const hotId = await semanticMemory.create({ content: "高热记忆" });
    await semanticMemory.create({ content: "冷门记忆" });

    const sessionId = "memref-resident";
    await seedSessionMeta(sessionId);
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: `[记忆 #${hotId}]`,
      pos: 1,
    });

    const resident = await semanticMemory.listResident(10);
    const ids = resident.map((r) => r.id);
    expect(ids).toContain(pinnedId);
    expect(ids).toContain(hotId);
    expect(resident.find((r) => r.id === pinnedId)?.pinned).toBe(true);
    expect((await semanticMemory.get(hotId))?.reference_count).toBe(2);
  });

  it("session 删除后引用作废，全量同步归零", async () => {
    const { semanticMemory, memoryReference, session } = getTestEngine().repos;

    const memoryId = await semanticMemory.create({ content: "待删除 session 引用" });
    const sessionId = "memref-delete";
    await seedSessionMeta(sessionId);
    await session.appendMessage(sessionId, {
      role: "user",
      content: `[记忆 #${memoryId}]`,
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
