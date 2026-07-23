import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";
import {
  countUnreadConversations,
  listConversationSummariesPage,
  markConversationRead,
} from "@freeanima/core/db/pg/conversation";
import { resolveNotificationRecipients } from "@freeanima/core/config";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

describePg("conversation_read_state（用户未读）", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-chat-unread-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("assistant 回复后未读；markRead 后清除", async () => {
    const engine = getTestEngine();
    const subject_id = resolveNotificationRecipients(engine.config.data).user.id;
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);

    await c.appendMessage({ role: "user", content: "hello", pos: 1 }, sid);
    await c.appendMessage({ role: "assistant", content: "hi there", pos: 2 }, sid);

    const before = await listConversationSummariesPage({
      platform: TEST_SAP_CHAT_PLATFORM,
      user_subject_id: subject_id,
      limit: 50,
    });
    const row = before.items.find((item) => item.id === sid);
    expect(row?.unread).toBe(true);
    expect(await countUnreadConversations(subject_id)).toBeGreaterThanOrEqual(1);

    const marked = await markConversationRead({ conversation_id: sid, subject_id });
    expect(marked.last_read_pos).toBeGreaterThan(0);

    const after = await listConversationSummariesPage({
      platform: TEST_SAP_CHAT_PLATFORM,
      user_subject_id: subject_id,
      limit: 50,
    });
    expect(after.items.find((item) => item.id === sid)?.unread).toBe(false);
  });
});
