import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/core/tool";

import { registerDiaryTools } from "./tools.ts";

describe("registerDiaryTools", () => {
  it("registers date-based diary toolset without create", () => {
    const registry = new ToolSetRegistry();
    registerDiaryTools(registry);
    const set = registry.getToolSet("diary");
    expect(set).not.toBeNull();
    const names = set!.tools.map((t) => t.name);
    expect(names).not.toContain("diary_create");
    expect(names).toContain("diary_append");
    expect(names).toContain("diary_get");
    expect(registry.getTool("diary_append")).not.toBeNull();
    const append = registry.getTool("diary_append")!;
    expect(append.parameters.required).toEqual(["content"]);
    expect(append.parameters.properties?.date).toBeDefined();
  });
});
