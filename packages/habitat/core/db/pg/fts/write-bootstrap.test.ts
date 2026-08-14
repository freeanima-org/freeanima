import { beforeEach, describe, expect, it } from "bun:test";
import { resetActiveConfigForTest } from "@freeanima/habitat/core/config";

import { resolveFtsSegmentedForWrite } from "./write.ts";

describe("resolveFtsSegmentedForWrite (bootstrap)", () => {
  beforeEach(() => {
    resetActiveConfigForTest();
  });

  it("returns null when active config is not bound", async () => {
    expect(await resolveFtsSegmentedForWrite("hello world")).toBeNull();
  });
});
