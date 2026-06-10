import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { MaskRegistry } from "./registry.ts";
import { resolveMask, resolveMaskByName } from "./resolve.ts";

function toolSetRegistry(): ToolSetRegistry {
  const reg = new ToolSetRegistry();
  reg.registerToolSet("browser", "Browser", [
    {
      name: "browser_navigate",
      description: "nav",
      parameters: { type: "object", properties: {} },
      handler: () => "{}",
    },
    {
      name: "browser_click",
      description: "click",
      parameters: { type: "object", properties: {} },
      handler: () => "{}",
    },
  ]);
  return reg;
}

describe("resolveMask", () => {
  it("expands inherits and merges allowed / denied", () => {
    const masks = new MaskRegistry();
    masks.register("base", {
      inherits: [],
      allowed_tools: ["memory_recall", "file_read_file"],
      denied_tools: [],
      auto_skills: ["skill_a"],
      credentials: [],
    });
    masks.register("child", {
      inherits: ["base"],
      allowed_tools: ["file_write_file"],
      denied_tools: ["file_read_file"],
      auto_skills: ["skill_b"],
      credentials: [],
    });
    const ts = toolSetRegistry();
    const resolved = resolveMaskByName("child", masks, ts);
    expect(resolved.allowed_tools.toSorted()).toEqual(["file_write_file", "memory_recall"]);
    expect(resolved.denied_tools).toEqual(["file_read_file"]);
    expect(resolved.auto_skills).toEqual(["skill_a", "skill_b"]);
  });

  it("throws on circular inheritance", () => {
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

  it("deny overrides allow", () => {
    const masks = new MaskRegistry();
    const mask = {
      inherits: [] as string[],
      allowed_tools: ["memory_recall", "grep"],
      denied_tools: ["grep"],
      auto_skills: [] as string[],
      credentials: [] as [],
    };
    const resolved = resolveMask(mask, masks, toolSetRegistry());
    expect(resolved.allowed_tools).toEqual(["memory_recall"]);
    expect(resolved.denied_tools).toEqual(["grep"]);
  });

  it("credential merge uses strictest (deny > allow > null)", () => {
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

  it("@ToolSet expands to concrete tool names", () => {
    const masks = new MaskRegistry();
    const mask = {
      inherits: [] as string[],
      allowed_tools: ["@browser", "memory_recall"],
      denied_tools: [],
      auto_skills: [] as string[],
      credentials: [] as [],
    };
    const resolved = resolveMask(mask, masks, toolSetRegistry());
    expect(resolved.allowed_tools).toEqual(["browser_click", "browser_navigate", "memory_recall"]);
  });
});
