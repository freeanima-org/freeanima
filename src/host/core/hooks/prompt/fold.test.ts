import { describe, expect, it } from "bun:test";
import { createTestHookRegistry } from "@freeanima/host/kernel/hooks/testing";
import { systemPromptBuild } from "./hooks.ts";
import { foldSystemPromptSections } from "./fold.ts";

describe("foldSystemPromptSections", () => {
  it("merges sections from multiple handlers by order", async () => {
    const registry = createTestHookRegistry();
    registry.on(systemPromptBuild, () => ({
      status: "ok",
      data: { sections: [{ id: "self", content: "SELF", order: 0 }] },
    }));
    registry.on(systemPromptBuild, () => ({
      status: "ok",
      data: { sections: [{ id: "toolsets", content: "TOOLSETS", order: 10 }] },
    }));
    const run = await registry.run(systemPromptBuild, { functionNames: [] });
    expect(foldSystemPromptSections(run.chain)).toBe("SELF\n\nTOOLSETS");
  });

  it("later handler overwrites same section id", async () => {
    const registry = createTestHookRegistry();
    registry.on(
      systemPromptBuild,
      () => ({
        status: "ok",
        data: { sections: [{ id: "self", content: "OLD", order: 0 }] },
      }),
      { priority: 50 },
    );
    registry.on(
      systemPromptBuild,
      () => ({
        status: "ok",
        data: { sections: [{ id: "self", content: "NEW", order: 0 }] },
      }),
      { priority: 100 },
    );
    const run = await registry.run(systemPromptBuild, { functionNames: [] });
    expect(foldSystemPromptSections(run.chain)).toBe("NEW");
  });

  it("skips failed handlers and empty content", async () => {
    const registry = createTestHookRegistry();
    registry.on(systemPromptBuild, () => ({ status: "failed", message: "x" }));
    registry.on(systemPromptBuild, () => ({
      status: "ok",
      data: { sections: [{ id: "a", content: "   ", order: 0 }] },
    }));
    registry.on(systemPromptBuild, () => ({
      status: "ok",
      data: { sections: [{ id: "b", content: "B", order: 1 }] },
    }));
    const run = await registry.run(systemPromptBuild, { functionNames: [] });
    expect(foldSystemPromptSections(run.chain)).toBe("B");
  });

  it("returns empty string when no sections", async () => {
    const registry = createTestHookRegistry();
    const run = await registry.run(systemPromptBuild, { functionNames: [] });
    expect(foldSystemPromptSections(run.chain)).toBe("");
  });
});
