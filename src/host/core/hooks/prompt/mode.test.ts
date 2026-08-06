import { describe, expect, it } from "bun:test";

import { resolvePromptMode } from "./mode.ts";

describe("resolvePromptMode", () => {
  it("coding → work", () => {
    expect(resolvePromptMode("coding")).toBe("work");
  });

  it("chat / null / undefined / other → digital_human", () => {
    expect(resolvePromptMode("chat")).toBe("digital_human");
    expect(resolvePromptMode(null)).toBe("digital_human");
    expect(resolvePromptMode(undefined)).toBe("digital_human");
    expect(resolvePromptMode("")).toBe("digital_human");
    expect(resolvePromptMode("discord")).toBe("digital_human");
  });
});
