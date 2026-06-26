import { describe, expect, it } from "bun:test";

import { ToolSetRegistry } from "./toolset.ts";
import {
  getToolContextId,
  getToolContextKind,
  getToolConversationId,
  getToolParentConversationId,
  getToolRegistry,
  grantExecutableTools,
  isExecutableTool,
  runWithToolContext,
} from "./tool-context.ts";

const sampleTool = {
  name: "demo_tool",
  description: "Demo",
  parameters: { type: "object", properties: {} },
  handler: () => '{"ok":true}',
};

describe("runWithToolContext", () => {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("local", "Local", [sampleTool]);

  it("exposes context inside sync fn", () => {
    runWithToolContext(
      "conv-1",
      () => {
        expect(getToolContextId()).toBe("conv-1");
        expect(getToolContextKind()).toBe("conversation");
        expect(getToolConversationId()).toBe("conv-1");
        expect(getToolRegistry()).toBe(registry);
      },
      { tools: registry },
    );
  });

  it("hides conversation id in auto_llm context", () => {
    runWithToolContext(
      "auto-1",
      () => {
        expect(getToolContextKind()).toBe("auto_llm");
        expect(getToolConversationId()).toBeUndefined();
      },
      { tools: registry, contextKind: "auto_llm" },
    );
  });

  it("passes parentConversationId", () => {
    runWithToolContext(
      "child",
      () => {
        expect(getToolParentConversationId()).toBe("parent");
      },
      { tools: registry, parentConversationId: "parent" },
    );
  });

  it("binds async generator steps to context", async () => {
    async function* gen(): AsyncGenerator<string | undefined> {
      yield getToolContextId();
      yield getToolContextId();
    }
    const iterable = runWithToolContext("async-conv", () => gen(), { tools: registry });
    const values: Array<string | undefined> = [];
    for await (const v of iterable) values.push(v);
    expect(values).toEqual(["async-conv", "async-conv"]);
  });

  it("throws when registry missing outside context", () => {
    expect(() => getToolRegistry()).toThrow("ToolSetRegistry not set");
  });
});

describe("executable tool allowlist", () => {
  const registry = new ToolSetRegistry();
  registry.registerToolSet("local", "Local", [sampleTool]);

  it("isExecutableTool returns undefined without allowlist", () => {
    runWithToolContext("c", () => expect(isExecutableTool("x")).toBeUndefined(), {
      tools: registry,
    });
  });

  it("grantExecutableTools extends allowlist in same turn", () => {
    runWithToolContext(
      "c",
      () => {
        expect(isExecutableTool("a")).toBe(false);
        grantExecutableTools(["a", " "]);
        expect(isExecutableTool("a")).toBe(true);
      },
      { tools: registry, executableTools: [] },
    );
  });
});
