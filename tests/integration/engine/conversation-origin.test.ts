import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../helpers/integration-case.ts";
import { endIntegrationCase } from "../../helpers/integration-case.ts";

import { isSessionMeta } from "@freeanima/legacy-kernel";
import * as conv from "@freeanima/legacy-engine";

describePg("conversation origin", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-origin-");
    home = ctx.home;
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
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
