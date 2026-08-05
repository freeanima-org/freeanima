import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { conversations } from "@freeanima/host/core/db/schema";
import { getDb } from "@freeanima/host/core/db/pg";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import {
  cleanupStaleConversations,
  STALE_SESSION_MIN_AGE_MS,
} from "@freeanima/host/engine/conversation";
import {
  appendMessage,
  conversationExists,
  listStaleConversationIdsForCleanup,
  upsertConversationMeta,
} from "@freeanima/host/core/db/pg/conversation";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

const STALE_UPDATED_AT = "2020-01-01T00:00:00+08:00";

async function seedMeta(conversationId: string, opts?: { debug?: boolean }): Promise<void> {
  await upsertConversationMeta(conversationId, {
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
    const emptyId = "cleanup_empty";
    const singleUserId = "cleanup_single_user";
    const singleAssistantId = "cleanup_single_assistant";
    const multiUserId = "cleanup_multi_user";
    const healthyId = "cleanup_healthy";

    await seedMeta(emptyId);
    await backdateSession(emptyId);

    await seedMeta(singleUserId);
    await appendMessage(singleUserId, {
      role: "user",
      content: "orphan user",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(singleUserId);

    await seedMeta(singleAssistantId);
    await appendMessage(singleAssistantId, {
      role: "assistant",
      content: "handoff summary",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(singleAssistantId);

    await seedMeta(multiUserId);
    await appendMessage(multiUserId, {
      role: "user",
      content: "u1",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await appendMessage(multiUserId, {
      role: "user",
      content: "u2",
      pos: 2,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(multiUserId);

    await seedMeta(healthyId);
    await appendMessage(healthyId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await appendMessage(healthyId, {
      role: "assistant",
      content: "hi",
      pos: 2,
      timestamp: new Date().toISOString(),
    });
    await backdateSession(healthyId);

    const result = await cleanupStaleConversations();

    expect(result.deleted).toBe(4);
    expect(result.ids.toSorted()).toEqual(
      [emptyId, singleUserId, singleAssistantId, multiUserId].toSorted(),
    );
    expect(await conversationExists(healthyId)).toBe(true);
    expect(await conversationExists(emptyId)).toBe(false);
  });

  it("skips recent zero-message sessions within 24h window", async () => {
    const recentEmptyId = "cleanup_recent_empty";

    await seedMeta(recentEmptyId);

    const result = await cleanupStaleConversations();

    expect(result.deleted).toBe(0);
    expect(await conversationExists(recentEmptyId)).toBe(true);
  });

  it("skips debug conversations even when stale", async () => {
    const debugId = "cleanup_debug_empty";

    await seedMeta(debugId, { debug: true });
    await backdateSession(debugId);

    const result = await cleanupStaleConversations();

    expect(result.deleted).toBe(0);
    expect(await conversationExists(debugId)).toBe(true);
  });

  it("listStaleConversationIdsForCleanup respects custom olderThan", async () => {
    const conversationId = "cleanup_custom_threshold";

    await seedMeta(conversationId);

    const withinWindow = await listStaleConversationIdsForCleanup({
      olderThan: new Date(Date.now() - STALE_SESSION_MIN_AGE_MS),
    });
    expect(withinWindow).not.toContain(conversationId);

    const pastNow = await listStaleConversationIdsForCleanup({
      olderThan: new Date(Date.now() + 60_000),
    });
    expect(pastNow).toContain(conversationId);
  });
});
