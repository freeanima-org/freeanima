import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { isSessionMeta } from "@freeanima/legacy-kernel";
import * as conv from "@freeanima/engine-conversation";

describePg("conversation origin", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-origin-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("findSessionByOrigin matches platform_extra keys", async () => {
    const sid = await conv.newSession("discord", undefined, {
      guild_id: "g1",
      channel_id: "c1",
      thread_id: "t1",
    });
    const found = await conv.findSessionByOrigin("discord", {
      guild_id: "g1",
      channel_id: "c1",
      thread_id: "t1",
    });
    expect(found).toBe(sid);

    const miss = await conv.findSessionByOrigin("discord", { thread_id: "other" });
    expect(miss).toBeNull();

    const meta = await conv.loadSessionMeta(sid);
    expect(isSessionMeta(meta) && meta.platform_extra?.thread_id).toBe("t1");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
