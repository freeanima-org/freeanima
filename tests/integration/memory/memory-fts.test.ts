import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { sql } from "drizzle-orm";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { filterRecallableMessages } from "@freeanima/capabilities/memory";
import { buildFtsTsQuery, getDb } from "@freeanima/core/db/pg";
import {
  createSemanticMemory,
  searchSemanticMemoryFts,
} from "@freeanima/core/db/pg/semantic-memory";
import { listMessages, searchMessagesFts } from "@freeanima/core/db/pg/conversation";
import { getTestEngine, seedSession } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";

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
        role: "conversation_meta",
        model: "test-model",
        cached_toolsets: [],
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

    const hits = await searchMessagesFts("hello", { limit: 10 });
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
        role: "conversation_meta",
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: "2026-05-26T10:00:00+08:00",
        platform: TEST_SAP_CHAT_PLATFORM,
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

    const msgs = await listMessages(sid);
    const filtered = filterRecallableMessages(msgs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.role).toBe("user");
  });

  it("CJK OR query tsquery is accepted by PostgreSQL and search succeeds", async () => {
    const query = "退烧 OR 注意力 OR 方向 摇摆 OR 热情";
    const tsquery = await buildFtsTsQuery(query);
    expect(tsquery).not.toMatch(/\)\s+\(/);

    const db = getDb();
    const parsed = await db
      .select({ q: sql<string>`to_tsquery('simple', ${tsquery})::text` })
      .from(sql`(SELECT 1) AS _`);
    expect(parsed[0]?.q).toBeTruthy();

    const sid = "20260615_120000_cjk";
    await seedSession(
      getTestEngine(),
      sid,
      {
        role: "conversation_meta",
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: "2026-06-15T12:00:00+08:00",
        platform: "web",
        title: "cjk fts",
      },
      [
        {
          role: "user",
          timestamp: "2026-06-15T12:00:00+08:00",
          content: "今天讨论退烧和注意力方向摇摆时的热情问题",
          pos: 1,
        },
      ],
    );

    const semanticId = await createSemanticMemory({
      content: "用户对退烧与注意力方向摇摆相关话题保持热情",
      type: "observation",
    });
    expect(semanticId).toBeGreaterThan(0);

    const messageHits = await searchMessagesFts(query, { limit: 5 });
    const semanticHits = await searchSemanticMemoryFts(query, { limit: 5 });
    expect(messageHits.length + semanticHits.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
