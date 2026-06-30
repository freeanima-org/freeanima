import { describe, expect, it, mock } from "bun:test";

mock.module("@freeanima/core/config", () => ({
  getActiveConfig: () => {
    throw new Error("Active Config not bound");
  },
  isCjkJiebaEnabled: () => true,
}));

mock.module("./segment.ts", () => ({
  segmentForFts: mock(async () => "should not run"),
}));

import { resolveFtsSegmentedForWrite } from "./write.ts";

describe("resolveFtsSegmentedForWrite (bootstrap)", () => {
  it("returns null when active config is not bound", async () => {
    expect(await resolveFtsSegmentedForWrite("hello world")).toBeNull();
  });
});
