import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { conversations } from "@freeanima/habitat/core/db/schema";
import { getDb } from "@freeanima/habitat/core/db/pg";
import { upsertConversationMeta } from "@freeanima/habitat/core/db/pg/conversation";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import {
  listConversationSummaries,
  pinConversation,
  unpinConversation,
} from "@freeanima/habitat/engine/conversation";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

async function seedMeta(conversationId: string): Promise<void> {
  await upsertConversationMeta(conversationId, {
    model: "test-model",
    cached_toolsets: [],
    functions: [],
    timestamp: new Date().toISOString(),
    platform: TEST_SAP_CHAT_PLATFORM,
    debug: false,
  });
}

async function backdateSession(conversationId: string, iso: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ updated_at: new Date(iso) })
    .where(eq(conversations.id, conversationId));
}

describePg("conversation pin (PostgreSQL)", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-conversation-pin-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("pins bubble to top of list and unpins restore updated_at order", async () => {
    const olderId = "pin_older";
    const newerId = "pin_newer";

    await seedMeta(olderId);
    await seedMeta(newerId);
    await backdateSession(olderId, "2020-01-01T00:00:00+08:00");
    await backdateSession(newerId, "2021-01-01T00:00:00+08:00");

    const before = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM);
    const beforeScoped = before
      .filter((s) => s.id === olderId || s.id === newerId)
      .map((s) => s.id);
    expect(beforeScoped).toEqual([newerId, olderId]);

    await pinConversation(olderId);
    const pinned = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM);
    const pinnedScoped = pinned
      .filter((s) => s.id === olderId || s.id === newerId)
      .map((s) => s.id);
    expect(pinnedScoped).toEqual([olderId, newerId]);
    expect(pinned.find((s) => s.id === olderId)?.pinned_at).toBeTruthy();
    expect(pinned.find((s) => s.id === newerId)?.pinned_at ?? null).toBeNull();

    await unpinConversation(olderId);
    const unpinned = await listConversationSummaries(TEST_SAP_CHAT_PLATFORM);
    const unpinnedScoped = unpinned
      .filter((s) => s.id === olderId || s.id === newerId)
      .map((s) => s.id);
    expect(unpinnedScoped).toEqual([olderId, newerId]);
    expect(unpinned.find((s) => s.id === olderId)?.pinned_at ?? null).toBeNull();
  });
});
