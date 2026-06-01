import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../helpers/pg-test-gate.js";
import { beginIntegrationCase, endIntegrationCase } from "../helpers/integration-case.js";

describePg("db session (PostgreSQL)", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-db-");
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("append/read session meta and messages", async () => {
    const { upsertSessionMeta, getSessionMeta, updateCompression } = await import(
      "@freeanima/db"
    );
    const { appendMessage, listMessages, nextMessageId } = await import("@freeanima/db");

    const sessionId = "20260530_test_db";
    await upsertSessionMeta(sessionId, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    const meta = await getSessionMeta(sessionId);
    expect(meta?.model).toBe("test-model");
    expect(meta?.platform).toBe("parlor");

    await appendMessage(sessionId, {
      role: "user",
      content: "hello",
      id: 1,
      timestamp: new Date().toISOString(),
    });
    await appendMessage(sessionId, {
      role: "assistant",
      content: "hi",
      id: 2,
      timestamp: new Date().toISOString(),
    });

    const msgs = await listMessages(sessionId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[1]?.content).toBe("hi");

    const next = await nextMessageId(sessionId);
    expect(next).toBe(3);

    await updateCompression(sessionId, { l2: 1, l3: 2 });
    const meta2 = await getSessionMeta(sessionId);
    expect(meta2?.compression).toEqual({ l2: 1, l3: 2 });
  });

  it("shiftMessagePositions 为中间插入腾出 pos", async () => {
    const { appendMessage, listMessages, shiftMessagePositions } = await import("@freeanima/db");
    const { upsertSessionMeta } = await import("@freeanima/db");

    const sessionId = "20260531_shift_test";
    await upsertSessionMeta(sessionId, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    await appendMessage(sessionId, {
      role: "user",
      content: "u1",
      id: 489,
      timestamp: new Date().toISOString(),
    });
    await appendMessage(sessionId, {
      role: "assistant",
      content: null,
      id: 490,
      timestamp: new Date().toISOString(),
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } },
      ],
    } as never);
    await appendMessage(sessionId, {
      role: "user",
      content: "u2",
      id: 491,
      timestamp: new Date().toISOString(),
    });
    await appendMessage(sessionId, {
      role: "assistant",
      content: "done",
      id: 500,
      timestamp: new Date().toISOString(),
    });

    await shiftMessagePositions(sessionId, 490, 1);
    await appendMessage(sessionId, {
      role: "tool",
      tool_call_id: "call_1",
      name: "read_file",
      content: '{"error":"repair"}',
      id: 491,
      timestamp: new Date().toISOString(),
    });

    const msgs = await listMessages(sessionId);
    expect(msgs.map((m) => m.id)).toEqual([489, 490, 491, 492, 501]);
    expect(msgs[2]?.role).toBe("tool");
    expect(msgs[3]?.role).toBe("user");
  });
});
