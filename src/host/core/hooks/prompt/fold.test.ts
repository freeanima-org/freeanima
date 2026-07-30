import { describe, expect, it } from "bun:test";
import { createTestHookRegistry } from "@freeanima/host/kernel/hooks/testing";
import { systemPromptBuild } from "./hooks.ts";
import { foldSystemPromptSections, foldSystemPromptSectionsDetailed } from "./fold.ts";

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

  it("applies per-section budgetChars", async () => {
    const registry = createTestHookRegistry();
    registry.on(systemPromptBuild, () => ({
      status: "ok",
      data: {
        sections: [
          {
            id: "env-health-baseline",
            content: "E".repeat(200),
            order: 15,
            budgetChars: 80,
            priority: 8,
          },
        ],
      },
    }));
    const run = await registry.run(systemPromptBuild, { functionNames: [] });
    const folded = foldSystemPromptSectionsDetailed(run.chain);
    expect(folded.text.length).toBeLessThanOrEqual(80);
    expect(folded.truncatedSectionIds).toContain("env-health-baseline");
  });

  it("drops low-priority sections under global budget but keeps self", async () => {
    const registry = createTestHookRegistry();
    registry.on(systemPromptBuild, () => ({
      status: "ok",
      data: {
        sections: [
          { id: "self", content: "SELF_CORE", order: 0, priority: 0 },
          { id: "memory-citation", content: "CITE", order: 25, priority: 1 },
          {
            id: "user-activity-stats",
            content: "ACTIVITY".repeat(20),
            order: 16,
            priority: 9,
          },
        ],
      },
    }));
    const run = await registry.run(systemPromptBuild, { functionNames: [] });
    const folded = foldSystemPromptSectionsDetailed(run.chain, {
      globalBudgetChars: 40,
    });
    expect(folded.text).toContain("SELF_CORE");
    expect(folded.text).toContain("CITE");
    expect(folded.droppedSectionIds).toContain("user-activity-stats");
  });
});
