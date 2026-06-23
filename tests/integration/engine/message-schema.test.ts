import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_PARLOR_PLATFORM } from "../../helpers/sap-parlor-test-platform.ts";

describePg("schemas/message", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("msg-schema-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("updateSessionMetaField preserves acp_tasks", async () => {
    const c = testConv();
    const sid = "schema_test";
    await c.initSession(sid, "m", { platform: TEST_SAP_PARLOR_PLATFORM });
    await c.updateSessionMetaField(sid, {
      acp_tasks: {
        "uuid-1": {
          status: "running",
          task_id: "t1",
          agent_name: "cursor",
          updated_at: "2026-06-11T00:00:00.000Z",
        },
      },
    });
    const meta = await c.loadSessionMeta(sid);
    expect(meta.role).toBe("session_meta");
    if (meta.role !== "session_meta") return;
    expect(meta.acp_tasks).toEqual({
      "uuid-1": {
        status: "running",
        task_id: "t1",
        agent_name: "cursor",
        updated_at: "2026-06-11T00:00:00.000Z",
      },
    });
  });
});
