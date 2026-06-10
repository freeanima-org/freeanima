import { describe, expect, it } from "bun:test";
import { MaskRegistry } from "./registry.ts";

describe("MaskRegistry", () => {
  it("register / get / list", () => {
    const reg = new MaskRegistry();
    reg.register("sleep", {
      inherits: [],
      allowed_tools: ["memory_recall"],
      denied_tools: [],
      auto_skills: [],
      credentials: [],
    });
    expect(reg.get("sleep")?.allowed_tools).toEqual(["memory_recall"]);
    expect(reg.list()).toHaveLength(1);
    expect(Object.isFrozen(reg.get("sleep"))).toBe(true);
  });

  it("同名 register 抛错", () => {
    const reg = new MaskRegistry();
    const empty = {
      inherits: [],
      allowed_tools: [],
      denied_tools: [],
      auto_skills: [],
      credentials: [],
    };
    reg.register("x", empty);
    expect(() => reg.register("x", empty)).toThrow("Mask 'x' already registered");
  });
});
