import { it, expect, beforeAll, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { beginIntegrationCase, endIntegrationCase } from "../../helpers/integration-case.ts";

import { testConv } from "../../helpers/pg-test.ts";

describePg("schemas/message", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeAll(async () => {
    await beginIntegrationCase("msg-schema-");
  });

  afterAll(async () => {
    await endIntegrationCase();
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("updateSessionMetaField preserves acp_sessions", async () => {
    const c = testConv();
    const sid = "schema_test";
    await c.initSession(sid, "m", { platform: "parlor" });
    await c.updateSessionMetaField(sid, { acp_sessions: { cursor: "uuid-1" } });
    const meta = await c.loadSessionMeta(sid);
    expect(meta.role).toBe("session_meta");
    if (meta.role !== "session_meta") return;
    expect(meta.acp_sessions).toEqual({ cursor: "uuid-1" });
  });
});
