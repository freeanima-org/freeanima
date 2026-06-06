import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import type { ConversationMessage } from "@freeanima/kernel-schemas";
import { kernel } from "@freeanima/service-bootstrap";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

describePg("db session (PostgreSQL)", () => {
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

  it("append/read session meta and messages", async () => {
    const session = kernel.repos.session;
    const sessionId = "20260530_test_db";
    await session.upsertSessionMeta(sessionId, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    const meta = await session.getSessionMeta(sessionId);
    expect(meta?.model).toBe("test-model");
    expect(meta?.platform).toBe("parlor");

    await session.appendMessage(sessionId, {
      role: "user",
      content: "hello",
      pos: 1,
      timestamp: new Date().toISOString(),
    });
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: "hi",
      pos: 2,
      timestamp: new Date().toISOString(),
    });

    const msgs = await session.listMessages(sessionId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[1]?.content).toBe("hi");

    const next = await session.nextMessagePos(sessionId);
    expect(next).toBe(3);

    await session.updateCompression(sessionId, { l2: 1, l3: 2 });
    const meta2 = await session.getSessionMeta(sessionId);
    expect(meta2?.compression).toEqual({ l2: 1, l3: 2 });
  });

  it("shiftMessagePositions 为中间插入腾出 pos", async () => {
    const session = kernel.repos.session;
    const sessionId = "20260531_shift_test";
    await session.upsertSessionMeta(sessionId, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    await session.appendMessage(sessionId, {
      role: "user",
      content: "u1",
      pos: 489,
      timestamp: new Date().toISOString(),
    });
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: null,
      pos: 490,
      timestamp: new Date().toISOString(),
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } },
      ],
    } as never);
    await session.appendMessage(sessionId, {
      role: "user",
      content: "u2",
      pos: 491,
      timestamp: new Date().toISOString(),
    });
    await session.appendMessage(sessionId, {
      role: "assistant",
      content: "done",
      pos: 500,
      timestamp: new Date().toISOString(),
    });

    await session.shiftMessagePositions(sessionId, 490, 1);
    await session.appendMessage(sessionId, {
      role: "tool",
      tool_call_id: "call_1",
      name: "read_file",
      content: '{"error":"repair"}',
      pos: 491,
      timestamp: new Date().toISOString(),
    });

    const msgs = await session.listMessages(sessionId);
    expect(msgs.map((m: ConversationMessage) => m.pos)).toEqual([489, 490, 491, 492, 501]);
    expect(msgs[2]?.role).toBe("tool");
    expect(msgs[3]?.role).toBe("user");
  });
});
