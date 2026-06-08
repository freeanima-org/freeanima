import { sql as drizzleSql } from "drizzle-orm";
import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { getDb } from "@freeanima/connectors-db-pg";
import { getTestEngine } from "../../helpers/pg-test.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { wireIntegrationServiceContext } from "../../helpers/integration-case.ts";
import { beginLogIsolation } from "../../helpers/log-isolation.ts";
import { pgTestUrl } from "../../helpers/pg-test-gate.ts";
import { setupIntegrationHome, teardownIntegrationHome } from "../../helpers/pg-test.ts";

const prevDriver = process.env.DATABASE_DRIVER;

describePg("Bun.sql driver", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    process.env.DATABASE_DRIVER = "bun";
    const home = beginLogIsolation("anima-bun-sql-");
    const pg = await setupIntegrationHome({ url: pgTestUrl!, home });
    wireIntegrationServiceContext(pg);
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    if (prevDriver === undefined) delete process.env.DATABASE_DRIVER;
    else process.env.DATABASE_DRIVER = prevDriver;
  });

  afterAll(async () => {
    await teardownIntegrationHome();
  });

  it("Bun.sql 原生连接可用", async () => {
    const db = getDb();
    const rows = await db.execute<{ n: number }>(drizzleSql`SELECT 1 AS n`);
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it.skip("JSONB assistant tool_calls round-trip（drizzle RQB + bun-sql rc.3 待上游修复）", async () => {
    const session = getTestEngine().repos.session;
    const sessionId = "bun_sql_jsonb_test";
    await session.upsertSessionMeta(sessionId, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    await session.appendMessage(sessionId, {
      role: "assistant",
      content: "",
      pos: 1,
      timestamp: new Date().toISOString(),
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "read_file", arguments: '{"path":"."}' },
        },
      ],
    });

    const msgs = await session.listMessages(sessionId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.role).toBe("assistant");
    if (msgs[0]?.role === "assistant") {
      expect(msgs[0].tool_calls?.[0]?.function.name).toBe("read_file");
    }
  });

  it.skip("并发 appendMessage（drizzle RQB + bun-sql rc.3 待上游修复）", async () => {
    const session = getTestEngine().repos.session;
    const sessionId = "bun_sql_concurrent";
    await session.upsertSessionMeta(sessionId, {
      role: "session_meta",
      model: "test-model",
      tools: [],
      functions: [],
      timestamp: new Date().toISOString(),
      platform: "parlor",
    });

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        session.appendMessage(sessionId, {
          role: "user",
          content: `msg-${i}`,
          pos: i + 1,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    const messages = await session.listMessages(sessionId);
    expect(messages).toHaveLength(8);
  });
});
