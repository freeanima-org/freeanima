import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import type { ConversationMessage } from "@freeanima/core/db/domain";
import { pingDatabase } from "@freeanima/platform/connectors/db-pg";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

describePg("db conversation (PostgreSQL)", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-db-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("Bun.sql native connection works", async () => {
    const ping = await pingDatabase();
    expect(ping.status).toBe("connected");
  });

  it("append/read conversation meta and messages", async () => {
    const conversation = getTestEngine().repos.conversation;
    const conversationId = "20260530_test_db";
    await conversation.upsertConversationMeta(conversationId, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const meta = await conversation.getConversationMeta(conversationId);
    expect(meta?.model).toBe("test-model");
    expect(meta?.platform).toBe(TEST_SAP_CHAT_PLATFORM);

    await conversation.appendMessage(conversationId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await conversation.appendMessage(conversationId, {
      role: "assistant",
      content: "hi",
      pos: 2,
      timestamp: new Date().toISOString(),
    });

    const msgs = await conversation.listMessages(conversationId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[1]?.content).toBe("hi");

    const next = await conversation.nextMessagePos(conversationId);
    expect(next).toBe(3);

    await conversation.updateCompression(conversationId, { l2: 1, l3: 2 });
    const meta2 = await conversation.getConversationMeta(conversationId);
    expect(meta2?.compression).toEqual({ l2: 1, l3: 2 });
  });

  it("JSONB assistant tool_calls round-trip", async () => {
    const conversation = getTestEngine().repos.conversation;
    const conversationId = "db_jsonb_tool_calls";
    await conversation.upsertConversationMeta(conversationId, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    await conversation.appendMessage(conversationId, {
      role: "assistant",
      content: "",
      pos: 1,
      timestamp: new Date().toISOString(),
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "file_read", arguments: '{"path":"."}' },
        },
      ],
    });

    const msgs = await conversation.listMessages(conversationId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.role).toBe("assistant");
    if (msgs[0]?.role === "assistant") {
      expect(msgs[0].tool_calls?.[0]?.function.name).toBe("file_read");
    }
  });

  it("concurrent appendMessage", async () => {
    const conversation = getTestEngine().repos.conversation;
    const conversationId = "db_concurrent_append";
    await conversation.upsertConversationMeta(conversationId, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        conversation.appendMessage(conversationId, {
          role: "user",
          content: `msg-${i}`,
          pos: i + 1,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    const messages = await conversation.listMessages(conversationId);
    expect(messages).toHaveLength(8);
  });

  it("shiftMessagePositions makes room for mid-stream insert", async () => {
    const conversation = getTestEngine().repos.conversation;
    const conversationId = "20260531_shift_test";
    await conversation.upsertConversationMeta(conversationId, {
      role: "conversation_meta",
      model: "test-model",
      cached_toolsets: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    await conversation.appendMessage(conversationId, {
      role: "user",
      content: "u1",
      pos: 489,
      timestamp: new Date().toISOString(),
    });
    await conversation.appendMessage(conversationId, {
      role: "assistant",
      content: null,
      pos: 490,
      timestamp: new Date().toISOString(),
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "file_read", arguments: "{}" } },
      ],
    } as never);
    await conversation.appendMessage(conversationId, {
      role: "user",
      content: "u2",
      pos: 491,
      timestamp: new Date().toISOString(),
    });
    await conversation.appendMessage(conversationId, {
      role: "assistant",
      content: "done",
      pos: 500,
      timestamp: new Date().toISOString(),
    });

    await conversation.shiftMessagePositions(conversationId, 490, 1);
    await conversation.appendMessage(conversationId, {
      role: "tool",
      tool_call_id: "call_1",
      name: "file_read",
      content: '{"error":"repair"}',
      pos: 491,
      timestamp: new Date().toISOString(),
    });

    const msgs = await conversation.listMessages(conversationId);
    expect(msgs.map((m: ConversationMessage) => m.pos)).toEqual([489, 490, 491, 492, 501]);
    expect(msgs[2]?.role).toBe("tool");
    expect(msgs[3]?.role).toBe("user");
  });
});
