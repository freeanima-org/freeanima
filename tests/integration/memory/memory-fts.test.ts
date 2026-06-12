import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { filterRecallableMessages } from "@freeanima/capabilities-memory";
import { getTestEngine, seedSession, testConv } from "../../helpers/pg-test.ts";

describePg("memory PG FTS", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-memfts-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("searchMessagesFts finds user/assistant messages", async () => {
    const sid = "20260526_120000_abcd";
    await seedSession(
      getTestEngine(),
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T12:00:00+08:00",
        platform: "web",
        title: "test",
      },
      [
        {
          role: "user",
          timestamp: "2026-05-26T12:00:00+08:00",
          content: "hello FTS",
          pos: 1,
        },
        {
          role: "assistant",
          timestamp: "2026-05-26T12:00:01+08:00",
          content: "hello there",
          pos: 2,
        },
        {
          role: "tool",
          tool_call_id: "tc1",
          timestamp: "2026-05-26T12:00:02+08:00",
          content: '{"result": "ignored"}',
          pos: 3,
        },
      ],
    );

    const store = testConv().repos.session;
    const hits = await store.searchMessagesFts("hello", { limit: 10 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.role === "user" || h.role === "assistant")).toBe(true);
    expect(hits.some((h) => h.content.includes("hello"))).toBe(true);
    expect(hits.every((h) => h.message_id.length > 0)).toBe(true);
  });

  it("filterRecallableMessages excludes tool messages", async () => {
    const sid = "20260526_130000_ef01";
    await seedSession(
      getTestEngine(),
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T10:00:00+08:00",
        platform: "parlor",
      },
      [
        { role: "user", timestamp: "2026-05-26T10:00:00+08:00", content: "a", pos: 1 },
        {
          role: "tool",
          tool_call_id: "tc1",
          timestamp: "2026-05-26T10:00:01+08:00",
          content: "tool body",
          pos: 2,
        },
      ],
    );

    const msgs = await testConv().repos.session.listMessages(sid);
    const filtered = filterRecallableMessages(msgs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.role).toBe("user");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
