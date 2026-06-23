import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { bindActiveConfig } from "@freeanima/platform/config";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import {
  awaitPendingEmbeddingsForTest,
  getFtsCoverageStats,
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  resetEmbedTextFnForTest,
  resetPendingEmbeddingsForTest,
} from "@freeanima/platform/connectors/db-pg";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "@freeanima/core/db/schema";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getActivePgTestContext, getTestEngine, seedSession } from "../../helpers/pg-test.ts";
import { TEST_SAP_PARLOR_PLATFORM } from "../../helpers/sap-parlor-test-platform.ts";

function minimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

function applyTestConfig(patch: Record<string, unknown>): void {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  ctx.config.update({ ...minimalConfig(), ...patch });
  bindActiveConfig(ctx.config);
}

function fixedEmbedding(value = 0.25): number[] {
  return Array.from({ length: SEMANTIC_EMBEDDING_DIMENSIONS }, () => value);
}

function sessionMeta() {
  return {
    role: "session_meta" as const,
    model: "test-model",
    cached_toolsets: [] as string[],
    functions: [] as string[],
    timestamp: new Date().toISOString(),
    platform: TEST_SAP_PARLOR_PLATFORM,
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
    const sessionId = "fts-rebuild-emb-msg";
    await seedSession(getTestEngine(), sessionId, sessionMeta(), [
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

    const sessionId = "fts-rebuild-emb-fail";
    await seedSession(getTestEngine(), sessionId, sessionMeta(), [
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
    const store = getTestEngine().repos.semanticMemory;

    const id = await store.create({
      content: "  padded semantic memory content  ",
      type: "world",
    });

    await awaitPendingEmbeddingsForTest();
    await ctx!.sql`UPDATE semantic_memory SET content_embedding = NULL WHERE id = ${id}`;

    const result = await rebuildAllFtsSegments({ onlyMissing: true });
    expect(result.embeddings?.semantic_memory).toBeGreaterThanOrEqual(1);

    const rows = await ctx!.sql<{ content_embedding: string | null }[]>`
      SELECT content_embedding::text AS content_embedding FROM semantic_memory WHERE id = ${id}
    `;
    expect(rows[0]?.content_embedding).not.toBeNull();
  });

  it("onlyMissing=true skips message rows with empty payload content", async () => {
    const sessionId = "fts-rebuild-emb-empty";
    await seedSession(getTestEngine(), sessionId, sessionMeta(), [
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
      SELECT id FROM messages WHERE session_id = ${sessionId} ORDER BY pos LIMIT 1
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
