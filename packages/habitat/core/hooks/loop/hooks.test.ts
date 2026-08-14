import { describe, expect, it } from "bun:test";
import { toolAfterCall } from "./index.ts";

describe("loop hooks", () => {
  it("toolAfterCall qualifiedId", () => {
    expect(toolAfterCall.qualifiedId).toBe(
      "@freeanima/habitat/kernel/loop-mechanism-hooks/tool-after-call",
    );
  });
});
