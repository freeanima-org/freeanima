import { describe, expect, it } from "bun:test";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { resolveEngineToolSchemas } from "./loop-engine.ts";

const sampleTool = {
  name: "dummy_tool",
  description: "Dummy",
  parameters: { type: "object" as const, properties: {} },
  handler: () => '{"ok":true}',
};

function registryWithDummy(): ToolSetRegistry {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("dummy", "Dummy set", [{ ...sampleTool }]);
  return registry;
}

describe("resolveEngineToolSchemas", () => {
  it("falls back to full registry when tools is omitted", () => {
    const toolRegistry = registryWithDummy();
    const schemas = resolveEngineToolSchemas({ toolRegistry });
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.function.name).toBe("dummy_tool");
  });

  it("keeps explicit empty tools array (does not expand to registry)", () => {
    const toolRegistry = registryWithDummy();
    const schemas = resolveEngineToolSchemas({ tools: [], toolRegistry });
    expect(schemas).toEqual([]);
  });

  it("uses the provided non-empty tools list", () => {
    const toolRegistry = registryWithDummy();
    const only = toolRegistry.openaiSchemasFromNames(["dummy_tool"]);
    const schemas = resolveEngineToolSchemas({ tools: only, toolRegistry });
    expect(schemas).toEqual(only);
  });
});
