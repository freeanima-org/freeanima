import { describe, expect, it } from "bun:test";
import { DEFAULT_SESSION_TOOL_NAMES, resolveDefaultSessionTools } from "./default-session-tools.ts";
import { ToolSetRegistry } from "./toolset.ts";

describe("resolveDefaultSessionTools", () => {
  it("仅返回 Registry 中已注册的工具", () => {
    const registry = new ToolSetRegistry();
    registry.registerToolSet("memory", "记忆", [
      {
        name: "recall",
        description: "回忆",
        parameters: { type: "object", properties: {} },
        handler: () => "ok",
      },
    ]);
    const resolved = resolveDefaultSessionTools(registry);
    expect(resolved).toContain("recall");
    expect(resolved.length).toBeLessThan(DEFAULT_SESSION_TOOL_NAMES.length);
  });
});
