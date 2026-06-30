import { describe, expect, it } from "bun:test";
import { createQualifiedToken, type PayloadOf } from "./index.ts";

describe("createQualifiedToken", () => {
  it("creates stable qualifiedId", () => {
    const t = createQualifiedToken<{ x: number }>("@freeanima/test/token");
    expect(t.qualifiedId).toBe("@freeanima/test/token");
    type P = PayloadOf<typeof t>;
    const _check: P = { x: 1 };
    expect(_check.x).toBe(1);
  });
});
