import { describe, expect, it } from "bun:test";
import { resolveDefaultSessionTools } from "./default-session-tools.ts";
import { ToolSetRegistry } from "./toolset.ts";

describe("resolveDefaultSessionTools", () => {
  it("returns only default tool names present in registry", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "memory", [
      {
        name: "memory_recall",
        description: "Recall",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const resolved = resolveDefaultSessionTools(registry);
    expect(resolved).toContain("memory_recall");
    expect(resolved).not.toContain("memory_remember");
  });
});
