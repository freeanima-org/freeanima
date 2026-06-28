import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { conversations, messages } from "@freeanima/core/db/schema";
import { getDb } from "@freeanima/platform/connectors/db-pg";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import {
  archiveConversation,
  cleanupStaleConversations,
  deleteUserConversation,
  listConversationSummaries,
  loadConversationMeta,
  unarchiveConversation,
} from "@freeanima/runtime/conversation";
import { getTestEngine } from "../../helpers/pg-test.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

const STALE_UPDATED_AT = "2020-01-01T00:00:00+08:00";

async function seedMeta(
  store: ReturnType<typeof getTestEngine>["repos"]["conversation"],
  conversationId: string,
  opts?: { debug?: boolean },
): Promise<void> {
  await store.upsertConversationMeta(conversationId, {
    role: "conversation_meta",
    model: "test-model",
    cached_toolsets: [],
    functions: [],
    timestamp: new Date().toISOString(),
    platform: TEST_SAP_CHAT_PLATFORM,
    debug: opts?.debug ?? false,
  });
}

async function backdateSession(conversationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ updated_at: STALE_UPDATED_AT })
    .where(eq(conversations.id, conversationId));
}

describePg("conversation archive/delete (PostgreSQL)", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-conversation-archive-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("loadConversationMeta reads PG lite row after archived_at column exists", async () => {
    const engine = getTestEngine();
    const store = engine.repos.conversation;
    const repos = engine.repos;
    const conversationId = "archive_meta_lite";

    await seedMeta(store, conversationId);

    const meta = await loadConversationMeta(repos, conversationId);
    expect(isConversationMeta(meta)).toBe(true);

    const liteMeta = await store.getConversationMetaLite(conversationId);
    expect(liteMeta).not.toBeNull();
    expect(liteMeta?.platform).toBe(TEST_SAP_CHAT_PLATFORM);
  });

  it("hides archived conversations from default list and restores on unarchive", async () => {
    const engine = getTestEngine();
    const store = engine.repos.conversation;
    const repos = engine.repos;

    const activeId = "archive_active";
    const archivedId = "archive_hidden";

    await seedMeta(store, activeId);
    await seedMeta(store, archivedId);
    await archiveConversation(repos, archivedId);

    const defaultList = await listConversationSummaries(repos, TEST_SAP_CHAT_PLATFORM);
    expect(defaultList.map((s) => s.id)).toEqual([activeId]);

    const fullList = await listConversationSummaries(repos, TEST_SAP_CHAT_PLATFORM, {
      includeArchived: true,
    });
    expect(fullList.map((s) => s.id).sort()).toEqual([activeId, archivedId].sort());
    expect(fullList.find((s) => s.id === archivedId)?.archived_at).toBeTruthy();

    await unarchiveConversation(repos, archivedId);
    const restored = await listConversationSummaries(repos, TEST_SAP_CHAT_PLATFORM);
    expect(restored.map((s) => s.id).sort()).toEqual([activeId, archivedId].sort());
  });

  it("hard deletes conversation and cascades messages", async () => {
    const engine = getTestEngine();
    const store = engine.repos.conversation;
    const repos = engine.repos;
    const db = getDb();

    const conversationId = "archive_delete_me";
    await seedMeta(store, conversationId);
    await store.appendMessage(conversationId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });

    await deleteUserConversation(repos, conversationId);

    const convRows = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    expect(convRows).toHaveLength(0);

    const msgRows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversation_id, conversationId));
    expect(msgRows).toHaveLength(0);
  });

  it("skips archived conversations during stale cleanup", async () => {
    const engine = getTestEngine();
    const store = engine.repos.conversation;
    const repos = engine.repos;

    const archivedStaleId = "archive_stale";
    await seedMeta(store, archivedStaleId);
    await backdateSession(archivedStaleId);
    await archiveConversation(repos, archivedStaleId);

    const result = await cleanupStaleConversations(repos);
    expect(result.ids).not.toContain(archivedStaleId);

    const rows = await getDb()
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, archivedStaleId));
    expect(rows).toHaveLength(1);
  });
});
