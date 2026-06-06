import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isSessionMeta } from "@freeanima/engine-db/domain";
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
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
