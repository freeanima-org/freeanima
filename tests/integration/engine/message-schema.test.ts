import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

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

  it("updateConversationMetaField preserves acp_tasks", async () => {
    const c = testConv();
    const sid = "schema_test";
    await c.initConversation(sid, "m", { platform: TEST_SAP_CHAT_PLATFORM });
    await c.updateConversationMetaField(sid, {
      acp_tasks: {
        "uuid-1": {
          status: "running",
          task_id: "t1",
          agent_name: "cursor",
          updated_at: "2026-06-11T00:00:00.000Z",
        },
      },
    });
    const meta = await c.loadConversationMeta(sid);
    expect(meta.role).toBe("conversation_meta");
    if (meta.role !== "conversation_meta") return;
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
