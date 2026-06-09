import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { MaskRegistry } from "./registry.ts";
import { resolveMask, resolveMaskByName } from "./resolve.ts";

function toolSetRegistry(): ToolSetRegistry {
  const reg = new ToolSetRegistry();
  reg.register("browser", "浏览器", ["browser_navigate", "browser_click"]);
  return reg;
}

describe("resolveMask", () => {
  it("展开 inherits 并合并 allowed / denied", () => {
    const masks = new MaskRegistry();
    masks.register("base", {
      inherits: [],
      allowed_tools: ["recall", "read_file"],
      denied_tools: [],
      auto_skills: ["skill_a"],
      credentials: [],
    });
    masks.register("child", {
      inherits: ["base"],
      allowed_tools: ["write_file"],
      denied_tools: ["read_file"],
      auto_skills: ["skill_b"],
      credentials: [],
    });
    const ts = toolSetRegistry();
    const resolved = resolveMaskByName("child", masks, ts);
    expect(resolved.allowed_tools).toEqual(["recall", "write_file"]);
    expect(resolved.denied_tools).toEqual(["read_file"]);
    expect(resolved.auto_skills).toEqual(["skill_a", "skill_b"]);
  });

  it("循环继承抛错", () => {
    const masks = new MaskRegistry();
    masks.register("a", {
      inherits: ["b"],
      allowed_tools: [],
      denied_tools: [],
      auto_skills: [],
      credentials: [],
    });
    masks.register("b", {
      inherits: ["a"],
      allowed_tools: [],
      denied_tools: [],
      auto_skills: [],
      credentials: [],
    });
    expect(() => resolveMaskByName("a", masks, toolSetRegistry())).toThrow(
      "Circular inheritance: a→b→a",
    );
  });

  it("deny 覆盖 allow", () => {
    const masks = new MaskRegistry();
    const mask = {
      inherits: [] as string[],
      allowed_tools: ["recall", "grep"],
      denied_tools: ["grep"],
      auto_skills: [] as string[],
      credentials: [] as [],
    };
    const resolved = resolveMask(mask, masks, toolSetRegistry());
    expect(resolved.allowed_tools).toEqual(["recall"]);
    expect(resolved.denied_tools).toEqual(["grep"]);
  });

  it("凭证合并取最严格（deny > allow > null）", () => {
    const masks = new MaskRegistry();
    masks.register("p1", {
      inherits: [],
      allowed_tools: [],
      denied_tools: [],
      auto_skills: [],
      credentials: [{ name: "api_key", read: "allow", write: null }],
    });
    masks.register("p2", {
      inherits: ["p1"],
      allowed_tools: [],
      denied_tools: [],
      auto_skills: [],
      credentials: [{ name: "api_key", read: "deny", write: "allow" }],
    });
    const resolved = resolveMaskByName("p2", masks, toolSetRegistry());
    expect(resolved.credentials).toEqual([{ name: "api_key", read: "deny", write: "allow" }]);
  });

  it("@ToolSet 展开为具体工具名", () => {
    const masks = new MaskRegistry();
    const mask = {
      inherits: [] as string[],
      allowed_tools: ["@browser", "recall"],
      denied_tools: [],
      auto_skills: [] as string[],
      credentials: [] as [],
    };
    const resolved = resolveMask(mask, masks, toolSetRegistry());
    expect(resolved.allowed_tools).toEqual(["browser_click", "browser_navigate", "recall"]);
  });
});
