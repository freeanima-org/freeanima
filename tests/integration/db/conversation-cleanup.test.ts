import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { conversations } from "@freeanima/core/db/schema";
import { getDb } from "@freeanima/platform/connectors/db-pg";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import {
  cleanupStaleConversations,
  STALE_SESSION_MIN_AGE_MS,
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
    .set({ updatedAt: STALE_UPDATED_AT })
    .where(eq(conversations.id, conversationId));
}

describePg("session cleanup (PostgreSQL)", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-conversation-cleanup-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("deletes stale zero-message, single-message, and multi-user-no-assistant sessions", async () => {
    const engine = getTestEngine();
    const conversation = engine.repos.conversation;

    const emptyId = "cleanup_empty";
    const singleUserId = "cleanup_single_user";
    const singleAssistantId = "cleanup_single_assistant";
    const multiUserId = "cleanup_multi_user";
    const healthyId = "cleanup_healthy";

    await seedMeta(conversation, emptyId);
    await backdateSession(emptyId);

    await seedMeta(conversation, singleUserId);
    await conversation.appendMessage(singleUserId, {
      role: "user",
      content: "orphan user",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(singleUserId);

    await seedMeta(conversation, singleAssistantId);
    await conversation.appendMessage(singleAssistantId, {
      role: "assistant",
      content: "handoff summary",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(singleAssistantId);

    await seedMeta(conversation, multiUserId);
    await conversation.appendMessage(multiUserId, {
      role: "user",
      content: "u1",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await conversation.appendMessage(multiUserId, {
      role: "user",
      content: "u2",
      pos: 2,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(multiUserId);

    await seedMeta(conversation, healthyId);
    await conversation.appendMessage(healthyId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await conversation.appendMessage(healthyId, {
      role: "assistant",
      content: "hi",
      pos: 2,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(healthyId);

    const result = await cleanupStaleConversations(engine.repos);

    expect(result.deleted).toBe(4);
    expect(result.ids.toSorted()).toEqual(
      [emptyId, singleUserId, singleAssistantId, multiUserId].toSorted(),
    );
    expect(await conversation.conversationExists(healthyId)).toBe(true);
    expect(await conversation.conversationExists(emptyId)).toBe(false);
  });

  it("skips recent zero-message sessions within 24h window", async () => {
    const engine = getTestEngine();
    const conversation = engine.repos.conversation;
    const recentEmptyId = "cleanup_recent_empty";

    await seedMeta(conversation, recentEmptyId);

    const result = await cleanupStaleConversations(engine.repos);

    expect(result.deleted).toBe(0);
    expect(await conversation.conversationExists(recentEmptyId)).toBe(true);
  });

  it("skips debug conversations even when stale", async () => {
    const engine = getTestEngine();
    const conversation = engine.repos.conversation;
    const debugId = "cleanup_debug_empty";

    await seedMeta(conversation, debugId, { debug: true });
    await backdateSession(debugId);

    const result = await cleanupStaleConversations(engine.repos);

    expect(result.deleted).toBe(0);
    expect(await conversation.conversationExists(debugId)).toBe(true);
  });

  it("listStaleConversationIdsForCleanup respects custom olderThan", async () => {
    const engine = getTestEngine();
    const conversation = engine.repos.conversation;
    const conversationId = "cleanup_custom_threshold";

    await seedMeta(conversation, conversationId);

    const withinWindow = await conversation.listStaleConversationIdsForCleanup({
      olderThan: new Date(Date.now() - STALE_SESSION_MIN_AGE_MS),
    });
    expect(withinWindow).not.toContain(conversationId);

    const pastNow = await conversation.listStaleConversationIdsForCleanup({
      olderThan: new Date(Date.now() + 60_000),
    });
    expect(pastNow).toContain(conversationId);
  });
});
