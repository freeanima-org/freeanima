import { describe, expect, it } from "bun:test";
import { toolAfterCall } from "./index.ts";

describe("loop hooks", () => {
  it("toolAfterCall qualifiedId", () => {
    expect(toolAfterCall.qualifiedId).toBe("@freeanima/host/engine/loop-hooks/tool-after-call");
  });
});
