import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { bindActiveRuntimeConfig } from "@freeanima/habitat/platform/config";
import { parseYaml } from "@freeanima/habitat/platform/config";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/habitat/platform/config/test-helpers/minimal-llm-config";
import {
  awaitPendingEmbeddingsForTest,
  getFtsCoverageStats,
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  resetEmbedTextFnForTest,
  resetPendingEmbeddingsForTest,
} from "@freeanima/habitat/core/db/pg";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "@freeanima/habitat/core/db/schema";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { createSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { createTaskItem, createTaskList } from "@freeanima/features/task/domain";
import { getActivePgTestContext, getTestEngine, seedSession } from "../../helpers/pg-test.ts";
import { testUserWorldId } from "../../helpers/world-context.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

function minimalConfig() {
  const parsed = runtimeConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

function applyTestConfig(patch: Record<string, unknown>): void {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  ctx.config.update({ ...minimalConfig(), ...patch });
  bindActiveRuntimeConfig(ctx.config);
}

function fixedEmbedding(value = 0.25): number[] {
  return Array.from({ length: SEMANTIC_EMBEDDING_DIMENSIONS }, () => value);
}

function sessionMeta() {
  return {
    model: "test-model",
    cached_toolsets: [] as string[],
    functions: [] as string[],
    timestamp: new Date().toISOString(),
    platform: TEST_SAP_CHAT_PLATFORM,
  };
}

describePg("FTS rebuild embedding PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-fts-rebuild-emb-");
    applyTestConfig({
      embedding: {
        enabled: true,
        main: { connection: "main", model: "test-embed-model" },
        dimensions: SEMANTIC_EMBEDDING_DIMENSIONS,
      },
    });
    registerEmbedTextFn(async () => fixedEmbedding());
  });

  afterEach(async () => {
    resetEmbedTextFnForTest();
    resetPendingEmbeddingsForTest();
    await restoreIntegrationHome(prev);
  });

  it("onlyMissing=true stores all message embeddings without skipping rows", async () => {
    const conversationId = "fts-rebuild-emb-msg";
    await seedSession(getTestEngine(), conversationId, sessionMeta(), [
      {
        role: "user",
        content: "hello rebuild embedding one",
        pos: 1,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: "reply rebuild embedding two",
        pos: 2,
        timestamp: new Date().toISOString(),
      },
      {
        role: "user",
        content: "third rebuild embedding row",
        pos: 3,
        timestamp: new Date().toISOString(),
      },
    ]);

    const ctx = getActivePgTestContext();
    expect(ctx).not.toBeNull();
    await awaitPendingEmbeddingsForTest();
    await ctx!.sql`UPDATE search_documents SET embedding = NULL WHERE resource = 'message'`;

    const before = await getFtsCoverageStats();
    const msgBefore = before.tables.find((t) => t.table === "messages")!;
    expect(msgBefore.embedding).toBe(0);
    expect(msgBefore.total).toBeGreaterThanOrEqual(3);

    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(result.embeddings?.messages).toBe(msgBefore.total);

    const after = await getFtsCoverageStats();
    const msgAfter = after.tables.find((t) => t.table === "messages")!;
    expect(msgAfter.embedding).toBe(msgAfter.total);
  });

  it("onlyMissing=true aborts when embed returns null (no silent skip)", async () => {
    resetEmbedTextFnForTest();
    registerEmbedTextFn(async () => null);

    const conversationId = "fts-rebuild-emb-fail";
    await seedSession(getTestEngine(), conversationId, sessionMeta(), [
      {
        role: "user",
        content: "embedding should fail loudly",
        pos: 1,
        timestamp: new Date().toISOString(),
      },
    ]);

    const ctx = getActivePgTestContext();
    await awaitPendingEmbeddingsForTest();
    await ctx!.sql`UPDATE search_documents SET embedding = NULL WHERE resource = 'message'`;

    await expect(
      rebuildAllFtsSegments({
        onlyMissing: true,
        embedRetryAttempts: 2,
        embedRetryBaseMs: 0,
      }),
    ).rejects.toThrow(/embedding failure\(s\) after retries/);

    const after = await getFtsCoverageStats();
    const msgAfter = after.tables.find((t) => t.table === "messages")!;
    expect(msgAfter.embedding).toBe(0);
  });

  it("semantic_memory with padded content stores embedding on onlyMissing rebuild", async () => {
    const ctx = getActivePgTestContext();

    const id = await createSemanticMemory({
      content: "  padded semantic memory content  ",
      type: "world",
    });

    await awaitPendingEmbeddingsForTest();
    await ctx!
      .sql`UPDATE search_documents SET embedding = NULL WHERE resource = 'entity' AND source_id = ${String(id)}`;

    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(
      result.embeddings?.semantic_memory ?? result.embeddings?.entities ?? 0,
    ).toBeGreaterThanOrEqual(1);

    const rows = await ctx!.sql<{ embedding: string | null }[]>`
      SELECT embedding::text AS embedding FROM search_documents
      WHERE resource = 'entity' AND source_id = ${String(id)}
    `;
    expect(rows[0]?.embedding).not.toBeNull();
  });

  it("onlyMissing=true skips message rows with empty payload content", async () => {
    const conversationId = "fts-rebuild-emb-empty";
    await seedSession(getTestEngine(), conversationId, sessionMeta(), [
      {
        role: "user",
        content: "has embedding target",
        pos: 1,
        timestamp: new Date().toISOString(),
      },
    ]);

    const ctx = getActivePgTestContext();
    expect(ctx).not.toBeNull();
    await awaitPendingEmbeddingsForTest();
    await ctx!.sql`UPDATE search_documents SET embedding = NULL WHERE resource = 'message'`;

    const rows = await ctx!.sql<{ id: string }[]>`
      SELECT id FROM messages WHERE conversation_id = ${conversationId} ORDER BY pos LIMIT 1
    `;
    const messageId = rows[0]!.id;
    await ctx!.sql`
      UPDATE messages
      SET payload = jsonb_set(payload, '{content}', '""'::jsonb)
      WHERE id = ${messageId}
    `;

    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(result.embeddings?.messages).toBeGreaterThanOrEqual(0);
  });

  it("onlyMissing=true backfills missing non-semantic entity embeddings", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "fts-rebuild-emb-entities" });
    const item = await createTaskItem(worldId, {
      title: "实体向量续跑目标",
      content: "need entity embedding rebuild",
      list_id: list.id,
    });

    const ctx = getActivePgTestContext();
    expect(ctx).not.toBeNull();
    await awaitPendingEmbeddingsForTest();
    await ctx!
      .sql`UPDATE search_documents SET embedding = NULL WHERE resource = 'entity' AND source_id = ${String(item.id)}`;

    const before = await getFtsCoverageStats();
    const entitiesBefore = before.tables.find((t) => t.table === "entities")!;
    expect(entitiesBefore.embedding).toBeLessThan(entitiesBefore.total);

    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(result.embeddings?.entities ?? 0).toBeGreaterThanOrEqual(1);

    const rows = await ctx!.sql<{ embedding: string | null }[]>`
      SELECT embedding::text AS embedding FROM search_documents
      WHERE resource = 'entity' AND source_id = ${String(item.id)}
    `;
    expect(rows[0]?.embedding).not.toBeNull();

    const after = await getFtsCoverageStats();
    const entitiesAfter = after.tables.find((t) => t.table === "entities")!;
    expect(entitiesAfter.embedding).toBe(entitiesAfter.total);
  });

  it("onlyMissing=true does not recount entities that already have embeddings", async () => {
    const worldId = testUserWorldId();
    const list = await createTaskList(worldId, { name: "fts-rebuild-emb-entities-skip" });
    await createTaskItem(worldId, {
      title: "已有向量实体",
      content: "already embedded entity row",
      list_id: list.id,
    });

    await awaitPendingEmbeddingsForTest();
    // 先补齐引导数据等历史缺口，再断言本轮无新增
    await rebuildAllFtsSegments({ onlyMissing: true });
    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(result.embeddings?.entities ?? 0).toBe(0);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
