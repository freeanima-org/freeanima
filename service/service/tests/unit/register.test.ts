import { listTools } from "@freeanima/engine-tool";
import { describe, it, expect, beforeEach } from "bun:test";

import { registerServiceTools } from "../../src/register.ts";

describe("registerServiceTools", () => {
  beforeEach(() => {
    // 模块级幂等标志无法在单测间重置；仅验证重复调用不抛错
  });

  it("registers core tool names", () => {
    registerServiceTools();
    const names = new Set(listTools().map((t) => t.name));
    expect(names.has("read_file")).toBe(true);
    expect(names.has("todo")).toBe(true);
    expect(names.has("cronjob")).toBe(true);
    expect(names.has("clarify")).toBe(true);
  });

  it("is idempotent", () => {
    const before = listTools().length;
    registerServiceTools();
    registerServiceTools();
    expect(listTools().length).toBe(before);
  });
});
