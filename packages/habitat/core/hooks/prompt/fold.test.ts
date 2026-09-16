import { describe, expect, it } from "bun:test";
import type { SystemPromptBuildEffect } from "./hooks.ts";
import { foldSystemPromptSections, foldSystemPromptSectionsDetailed } from "./fold.ts";

function effect(
  sections: NonNullable<SystemPromptBuildEffect["sections"]>,
): SystemPromptBuildEffect {
  return { sections };
}

describe("foldSystemPromptSections", () => {
  it("merges sections from multiple effects by order", () => {
    const effects = [
      effect([{ id: "self", content: "SELF", order: 0 }]),
      effect([{ id: "toolsets", content: "TOOLSETS", order: 10 }]),
    ];
    expect(foldSystemPromptSections(effects)).toBe("SELF\n\nTOOLSETS");
  });

  it("later effect overwrites same section id", () => {
    const effects = [
      effect([{ id: "self", content: "OLD", order: 0 }]),
      effect([{ id: "self", content: "NEW", order: 0 }]),
    ];
    expect(foldSystemPromptSections(effects)).toBe("NEW");
  });

  it("skips empty content", () => {
    const effects = [
      effect([{ id: "a", content: "   ", order: 0 }]),
      effect([{ id: "b", content: "B", order: 1 }]),
    ];
    expect(foldSystemPromptSections(effects)).toBe("B");
  });

  it("returns empty string when no sections", () => {
    expect(foldSystemPromptSections([])).toBe("");
  });

  it("applies per-section budgetChars with xmlTag without breaking closing tag", () => {
    const folded = foldSystemPromptSectionsDetailed([
      effect([
        {
          id: "env-health-baseline",
          content: "E".repeat(200),
          order: 15,
          budgetChars: 80,
          priority: 8,
          xmlTag: "env_health",
          xmlFrame: "Frame.",
        },
      ]),
    ]);
    expect(folded.text.length).toBeLessThanOrEqual(80);
    expect(folded.text).toContain("<env_health>");
    expect(folded.text).toContain("</env_health>");
    expect(folded.truncatedSectionIds).toContain("env-health-baseline");
  });

  it("applies per-section budgetChars", () => {
    const folded = foldSystemPromptSectionsDetailed([
      effect([
        {
          id: "env-health-baseline",
          content: "E".repeat(200),
          order: 15,
          budgetChars: 80,
          priority: 8,
        },
      ]),
    ]);
    expect(folded.text.length).toBeLessThanOrEqual(80);
    expect(folded.truncatedSectionIds).toContain("env-health-baseline");
  });

  it("truncates low-priority sections under global budget before dropping", () => {
    const folded = foldSystemPromptSectionsDetailed(
      [
        effect([
          { id: "self", content: "SELF_CORE", order: 0, priority: 0 },
          { id: "memory-citation", content: "CITE", order: 25, priority: 1 },
          {
            id: "user-activity-stats",
            content: "ACTIVITY".repeat(20),
            order: 16,
            priority: 9,
          },
        ]),
      ],
      { globalBudgetChars: 80 },
    );
    expect(folded.text).toContain("SELF_CORE");
    expect(folded.text).toContain("CITE");
    expect(folded.truncatedSectionIds).toContain("user-activity-stats");
    expect(folded.droppedSectionIds).not.toContain("user-activity-stats");
  });

  it("drops a non-hardKeep section only when truncation cannot retain content", () => {
    const folded = foldSystemPromptSectionsDetailed(
      [
        effect([
          { id: "self", content: "SELF_CORE", order: 0, priority: 0 },
          { id: "memory-citation", content: "CITE", order: 25, priority: 1 },
          {
            id: "user-activity-stats",
            content: "ACTIVITY".repeat(20),
            order: 16,
            priority: 9,
          },
        ]),
      ],
      { globalBudgetChars: 40 },
    );
    expect(folded.text).toContain("SELF_CORE");
    expect(folded.text).toContain("CITE");
    expect(folded.droppedSectionIds).toContain("user-activity-stats");
  });

  it("keeps anima-uri-protocol under tight global budget", () => {
    const folded = foldSystemPromptSectionsDetailed(
      [
        effect([
          { id: "self", content: "SELF_CORE", order: 0, priority: 0 },
          {
            id: "anima-uri-protocol",
            content: "ANIMA_URI_RULE",
            order: 24,
            priority: 1,
          },
          {
            id: "user-activity-stats",
            content: "ACTIVITY".repeat(20),
            order: 16,
            priority: 9,
          },
        ]),
      ],
      { globalBudgetChars: 40 },
    );
    expect(folded.text).toContain("SELF_CORE");
    expect(folded.text).toContain("ANIMA_URI");
    expect(folded.droppedSectionIds).toContain("user-activity-stats");
    expect(folded.droppedSectionIds).not.toContain("anima-uri-protocol");
  });
});
