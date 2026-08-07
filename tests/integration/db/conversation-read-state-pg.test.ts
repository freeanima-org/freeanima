import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";
import {
  archiveConversation,
  countUnreadConversations,
  deleteConversation,
  listConversationSummariesPage,
  markConversationRead,
} from "@freeanima/host/core/db/pg/conversation";
import { resolveNotificationRecipients } from "@freeanima/host/core/config";
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
    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      1,
    );

    const marked = await markConversationRead({ conversation_id: sid, subject_id });
    expect(marked.last_read_pos).toBeGreaterThan(0);

    const after = await listConversationSummariesPage({
      platform: TEST_SAP_CHAT_PLATFORM,
      user_subject_id: subject_id,
      limit: 50,
    });
    expect(after.items.find((item) => item.id === sid)?.unread).toBe(false);
    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      0,
    );
  });

  it("删除未读会话后 COUNT 下降", async () => {
    const engine = getTestEngine();
    const subject_id = resolveNotificationRecipients(engine.config.data).user.id;
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);

    await c.appendMessage({ role: "user", content: "hello", pos: 1 }, sid);
    await c.appendMessage({ role: "assistant", content: "hi", pos: 2 }, sid);

    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      1,
    );

    await deleteConversation(sid);

    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      0,
    );
  });

  it("归档未读会话后未归档 COUNT 不含该项", async () => {
    const engine = getTestEngine();
    const subject_id = resolveNotificationRecipients(engine.config.data).user.id;
    const c = testConv();
    const sid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);

    await c.appendMessage({ role: "user", content: "hello", pos: 1 }, sid);
    await c.appendMessage({ role: "assistant", content: "hi", pos: 2 }, sid);

    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      1,
    );

    await archiveConversation(sid);

    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      0,
    );
  });

  it("其它 platform 未读不计入 platform=chat 的 COUNT", async () => {
    const engine = getTestEngine();
    const subject_id = resolveNotificationRecipients(engine.config.data).user.id;
    const c = testConv();
    const otherPlatform = "remote:companion:test-unread";
    const chatSid = await c.newConversation(TEST_SAP_CHAT_PLATFORM);
    const otherSid = await c.newConversation(otherPlatform);

    await c.appendMessage({ role: "user", content: "a", pos: 1 }, chatSid);
    await c.appendMessage({ role: "assistant", content: "b", pos: 2 }, chatSid);
    await c.appendMessage({ role: "user", content: "c", pos: 1 }, otherSid);
    await c.appendMessage({ role: "assistant", content: "d", pos: 2 }, otherSid);

    expect(await countUnreadConversations(subject_id)).toBeGreaterThanOrEqual(2);
    expect(await countUnreadConversations(subject_id, { platform: TEST_SAP_CHAT_PLATFORM })).toBe(
      1,
    );
    expect(await countUnreadConversations(subject_id, { platform: otherPlatform })).toBe(1);
  });
});
