import { describe, expect, it } from "bun:test";
import { resolveDefaultSessionTools } from "./default-session-tools.ts";
import { ToolSetRegistry } from "./toolset.ts";

describe("resolveDefaultSessionTools", () => {
  it("仅返回 registry 中存在的默认工具名", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "记忆", [
      {
        name: "memory_recall",
        description: "召回",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const resolved = resolveDefaultSessionTools(registry);
    expect(resolved).toContain("memory_recall");
    expect(resolved).not.toContain("memory_remember");
  });
});
