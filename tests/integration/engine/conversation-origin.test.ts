import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { testConv } from "../../helpers/pg-test.ts";

describePg("conversation origin", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-origin-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("findConversationByOrigin matches platform_extra keys", async () => {
    const c = testConv();
    const sid = await c.newConversation("discord", undefined, {
      guild_id: "g1",
      channel_id: "c1",
      thread_id: "t1",
    });
    await c.activateConversationOrigin(sid);
    const found = await c.findConversationByOrigin("discord", {
      guild_id: "g1",
      channel_id: "c1",
      thread_id: "t1",
    });
    expect(found).toBe(sid);

    const miss = await c.findConversationByOrigin("discord", { thread_id: "other" });
    expect(miss).toBeNull();

    const meta = await c.loadConversationMeta(sid);
    expect(isConversationMeta(meta) && meta.platform_extra?.thread_id).toBe("t1");
    expect(isConversationMeta(meta) && meta.platform_extra?.origin_active).toBe(true);
  });

  it("/new switches origin_active to new conversation", async () => {
    const c = testConv();
    const origin = {
      guild_id: "g2",
      channel_id: "c2",
      thread_id: "t2",
    };
    const oldSid = await c.newConversation("discord", undefined, origin);
    await c.activateConversationOrigin(oldSid);
    await c.appendMessage({ role: "user", content: "hello" }, oldSid);

    const newSid = await c.newConversation("discord");
    await c.patchConversationOrigin(newSid, "discord", origin);
    await c.activateConversationOrigin(newSid);

    const routed = await c.findConversationByOrigin("discord", origin);
    expect(routed).toBe(newSid);

    const oldMeta = await c.loadConversationMeta(oldSid);
    const newMeta = await c.loadConversationMeta(newSid);
    expect(isConversationMeta(oldMeta) && oldMeta.platform_extra?.origin_active).toBe(false);
    expect(isConversationMeta(newMeta) && newMeta.platform_extra?.origin_active).toBe(true);
    expect(isConversationMeta(oldMeta) && oldMeta.platform_extra?.thread_id).toBe("t2");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
