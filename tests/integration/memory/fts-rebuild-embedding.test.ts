import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { bindActiveRuntimeConfig } from "@freeanima/host/platform/config";
import { parseYaml } from "@freeanima/host/platform/config";
import { animaConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";
import {
  awaitPendingEmbeddingsForTest,
  getFtsCoverageStats,
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  resetEmbedTextFnForTest,
  resetPendingEmbeddingsForTest,
} from "@freeanima/host/core/db/pg";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "@freeanima/host/core/db/schema";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { createSemanticMemory } from "@freeanima/host/core/db/pg/semantic-memory";
import { getActivePgTestContext, getTestEngine, seedSession } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

function minimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
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
    role: "conversation_meta" as const,
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
        model: "test-embed-model",
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
    await ctx!.sql`UPDATE messages SET content_embedding = NULL`;

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
    await ctx!.sql`UPDATE messages SET content_embedding = NULL`;

    await expect(rebuildAllFtsSegments({ onlyMissing: true })).rejects.toThrow(
      /stored 0 embeddings/,
    );

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
    await ctx!.sql`UPDATE entities SET search_embedding = NULL WHERE id = ${id}`;

    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(
      result.embeddings?.semantic_memory ?? result.embeddings?.entities ?? 0,
    ).toBeGreaterThanOrEqual(1);

    const rows = await ctx!.sql<{ search_embedding: string | null }[]>`
      SELECT search_embedding::text AS search_embedding FROM entities WHERE id = ${id}
    `;
    expect(rows[0]?.search_embedding).not.toBeNull();
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
    await ctx!.sql`UPDATE messages SET content_embedding = NULL`;

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

  afterAll(async () => {
    await endIntegrationCase();
  });
});
