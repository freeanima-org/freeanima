import { afterEach, describe, expect, it } from "bun:test";

import {
  pgProfileEnabled,
  pgProfileRecord,
  pgProfileReset,
  pgProfileSummary,
  pgProfileWrap,
} from "../../src/pg-profile.ts";

describe("pg-profile", () => {
  afterEach(() => {
    pgProfileReset();
  });

  it("默认关闭", () => {
    expect(pgProfileEnabled()).toBe(false);
  });

  it("开启时累计 op", async () => {
    const prev = process.env.ANIMA_L1_PG_PROFILE;
    process.env.ANIMA_L1_PG_PROFILE = "1";
    try {
      await pgProfileWrap("listMessages", async () => [1, 2], { sessionId: "s1" });
      pgProfileRecord("appendMessage", 3);
      const summary = pgProfileSummary();
      expect(summary.listMessages?.count).toBe(1);
      expect(summary.appendMessage?.count).toBe(1);
    } finally {
      if (prev === undefined) delete process.env.ANIMA_L1_PG_PROFILE;
      else process.env.ANIMA_L1_PG_PROFILE = prev;
      pgProfileReset();
    }
  });
});
