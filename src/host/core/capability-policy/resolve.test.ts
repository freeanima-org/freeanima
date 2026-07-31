import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { resolveCapabilityPolicy } from "./resolve.ts";

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

describe("resolveCapabilityPolicy", () => {
  it("unions skill allows and subtracts caller denies", () => {
    const resolved = resolveCapabilityPolicy(
      {
        skills: [
          { allowed_tools: ["memory_semantic_search", "file_read"], denied_tools: [] },
          { allowed_tools: ["@browser"], denied_tools: [] },
        ],
        caller: { allowed_tools: [], denied_tools: ["file_read", "browser_click"] },
      },
      toolSetRegistry(),
    );
    expect(resolved.allowed_tools.toSorted()).toEqual([
      "browser_navigate",
      "memory_semantic_search",
    ]);
    expect(resolved.denied_tools.toSorted()).toEqual(["browser_click", "file_read"]);
  });

  it("deny overrides allow within same fragment", () => {
    const resolved = resolveCapabilityPolicy(
      {
        skills: [{ allowed_tools: ["memory_semantic_search", "grep"], denied_tools: ["grep"] }],
      },
      toolSetRegistry(),
    );
    expect(resolved.allowed_tools).toEqual(["memory_semantic_search"]);
    expect(resolved.denied_tools).toEqual(["grep"]);
  });

  it("returns empty when no fragments", () => {
    const resolved = resolveCapabilityPolicy({}, toolSetRegistry());
    expect(resolved.allowed_tools).toEqual([]);
    expect(resolved.denied_tools).toEqual([]);
  });
});
