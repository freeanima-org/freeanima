import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import { conversations, messages } from "@freeanima/host/core/db/schema";
import { getDb } from "@freeanima/host/core/db/pg";
import {
  appendMessage,
  getConversationMetaLite,
  upsertConversationMeta,
} from "@freeanima/host/core/db/pg/conversation";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import {
  archiveConversation,
  cleanupStaleConversations,
  deleteUserConversation,
  listConversationSummaries,
  loadConversationMeta,
  unarchiveConversation,
} from "@freeanima/host/engine/conversation";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

const STALE_UPDATED_AT = "2020-01-01T00:00:00+08:00";

async function seedMeta(conversationId: string, opts?: { debug?: boolean }): Promise<void> {
  await upsertConversationMeta(conversationId, {
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
    .set({ updated_at: new Date(STALE_UPDATED_AT) })
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
    const conversationId = "archive_meta_lite";

    await seedMeta(conversationId);

    const meta = await loadConversationMeta(conversationId);
    expect(isConversationMeta(meta)).toBe(true);

    const liteMeta = await getConversationMetaLite(conversationId);
    expect(liteMeta).not.toBeNull();
    expect(liteMeta?.platform).toBe(TEST_SAP_CHAT_PLATFORM);
  });

  it("lists conversations by updated_at descending", async () => {
    const olderId = "archive_sort_older";
    const newerId = "archive_sort_newer";

    await seedMeta(olderId);
    await seedMeta(newerId);
    await backdateSession(olderId);

    await appendMessage(newerId, {
      role: "user",
      content: "bump",
      pos: 1,
      timestamp: new Date().toISOString(),
    });

    const list = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM);
    const scoped = list.filter((s) => s.id === newerId || s.id === olderId).map((s) => s.id);
    expect(scoped).toEqual([newerId, olderId]);
  });

  it("hides archived conversations from default list and restores on unarchive", async () => {
    const activeId = "archive_active";
    const archivedId = "archive_hidden";

    await seedMeta(activeId);
    await seedMeta(archivedId);
    await archiveConversation(archivedId);

    const defaultList = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM);
    const defaultScoped = defaultList
      .filter((s) => s.id === activeId || s.id === archivedId)
      .map((s) => s.id);
    expect(defaultScoped).toEqual([activeId]);

    const fullList = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM, {
      includeArchived: true,
    });
    const fullScoped = fullList
      .filter((s) => s.id === activeId || s.id === archivedId)
      .map((s) => s.id);
    expect(fullScoped.toSorted()).toEqual([activeId, archivedId].toSorted());
    expect(fullList.find((s) => s.id === archivedId)?.archived_at).toBeTruthy();

    await unarchiveConversation(archivedId);
    const restored = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM);
    const restoredScoped = restored
      .filter((s) => s.id === activeId || s.id === archivedId)
      .map((s) => s.id);
    expect(restoredScoped.toSorted()).toEqual([activeId, archivedId].toSorted());
  });

  it("hard deletes conversation and cascades messages", async () => {
    const db = getDb();

    const conversationId = "archive_delete_me";
    await seedMeta(conversationId);
    await appendMessage(conversationId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });

    await deleteUserConversation(conversationId);

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
    const archivedStaleId = "archive_stale";
    await seedMeta(archivedStaleId);
    await backdateSession(archivedStaleId);
    await archiveConversation(archivedStaleId);

    const result = await cleanupStaleConversations();
    expect(result.ids).not.toContain(archivedStaleId);

    const rows = await getDb()
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, archivedStaleId));
    expect(rows).toHaveLength(1);
  });
});
