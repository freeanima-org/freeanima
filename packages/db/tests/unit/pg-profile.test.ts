import { afterEach, describe, expect, it, vi } from "vitest";

import {
  pgProfileEnabled,
  pgProfileRecord,
  pgProfileReset,
  pgProfileSummary,
  pgProfileWrap,
} from "../../src/pg-profile.js";

describe("pg-profile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    pgProfileReset();
  });

  it("默认关闭", () => {
    expect(pgProfileEnabled()).toBe(false);
  });

  it("开启时累计 op", async () => {
    vi.stubEnv("ANIMA_L1_PG_PROFILE", "1");
    await pgProfileWrap("listMessages", async () => [1, 2], { sessionId: "s1" });
    pgProfileRecord("appendMessage", 3);
    const summary = pgProfileSummary();
    expect(summary.listMessages?.count).toBe(1);
    expect(summary.appendMessage?.count).toBe(1);
  });
});
