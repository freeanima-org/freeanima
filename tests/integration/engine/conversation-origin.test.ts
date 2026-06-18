import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isSessionMeta } from "@freeanima/core/db/domain";
import { testConv } from "../../helpers/pg-test.ts";

describePg("conversation origin", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-origin-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("findSessionByOrigin matches platform_extra keys", async () => {
    const c = testConv();
    const sid = await c.newSession("discord", undefined, {
      guild_id: "g1",
      channel_id: "c1",
      thread_id: "t1",
    });
    await c.activateSessionOrigin(sid);
    const found = await c.findSessionByOrigin("discord", {
      guild_id: "g1",
      channel_id: "c1",
      thread_id: "t1",
    });
    expect(found).toBe(sid);

    const miss = await c.findSessionByOrigin("discord", { thread_id: "other" });
    expect(miss).toBeNull();

    const meta = await c.loadSessionMeta(sid);
    expect(isSessionMeta(meta) && meta.platform_extra?.thread_id).toBe("t1");
    expect(isSessionMeta(meta) && meta.platform_extra?.origin_active).toBe(true);
  });

  it("/new switches origin_active to new session", async () => {
    const c = testConv();
    const origin = {
      guild_id: "g2",
      channel_id: "c2",
      thread_id: "t2",
    };
    const oldSid = await c.newSession("discord", undefined, origin);
    await c.activateSessionOrigin(oldSid);
    await c.appendMessage({ role: "user", content: "hello" }, oldSid);

    const newSid = await c.newSession("discord");
    await c.patchSessionOrigin(newSid, "discord", origin);
    await c.activateSessionOrigin(newSid);

    const routed = await c.findSessionByOrigin("discord", origin);
    expect(routed).toBe(newSid);

    const oldMeta = await c.loadSessionMeta(oldSid);
    const newMeta = await c.loadSessionMeta(newSid);
    expect(isSessionMeta(oldMeta) && oldMeta.platform_extra?.origin_active).toBe(false);
    expect(isSessionMeta(newMeta) && newMeta.platform_extra?.origin_active).toBe(true);
    expect(isSessionMeta(oldMeta) && oldMeta.platform_extra?.thread_id).toBe("t2");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
