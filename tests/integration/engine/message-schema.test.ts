import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";

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
    await c.initConversation(sid, "m", { platform: TEST_SAP_CHAT_PLATFORM, agent_subject_id: 2 });
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
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;
    expect(meta.acp_tasks).toEqual({
      "uuid-1": {
        status: "running",
        task_id: "t1",
        agent_name: "cursor",
        updated_at: "2026-06-11T00:00:00.000Z",
      },
    });
  });

  it("patch without compression key preserves compression boundaries", async () => {
    const c = testConv();
    const sid = "schema_compression_preserve";
    await c.initConversation(sid, "m", { platform: TEST_SAP_CHAT_PLATFORM, agent_subject_id: 2 });
    await c.updateConversationMetaField(sid, {
      compression: { l2: 100, l3: 100, summary: "kept summary" },
    });
    await c.updateConversationMetaField(sid, {
      cached_toolsets: ["toolset"],
      staged_toolsets: [],
    });
    await c.updateConversationMetaField(sid, {
      system_prompt: "rebuilt prompt",
      system_prompt_built_at: new Date().toISOString(),
    });
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;
    expect(meta.compression).toEqual({
      l2: 100,
      l3: 100,
      summary: "kept summary",
    });
    expect(meta.cached_toolsets).toEqual(["toolset"]);
    expect(meta.system_prompt).toBe("rebuilt prompt");
  });

  it("explicit compression null clears boundaries", async () => {
    const c = testConv();
    const sid = "schema_compression_clear";
    await c.initConversation(sid, "m", { platform: TEST_SAP_CHAT_PLATFORM, agent_subject_id: 2 });
    await c.updateConversationMetaField(sid, {
      compression: { l2: 50, l3: 50, summary: "gone" },
    });
    await c.updateConversationMetaField(sid, { compression: null });
    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta)).toBe(true);
    if (!isConversationMeta(meta)) return;
    expect(meta.compression ?? null).toBeNull();
  });
});
