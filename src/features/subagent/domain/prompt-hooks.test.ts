import { describe, expect, it } from "bun:test";

import { formatSubagentCatalogContent } from "./prompt-hooks.ts";
import type { SubagentRow } from "./types.ts";

function row(partial: Partial<SubagentRow> & Pick<SubagentRow, "slug">): SubagentRow {
  return {
    id: 1,
    world_id: 1,
    title: partial.title ?? partial.slug,
    summary: partial.summary ?? "",
    content: "",
    slug: partial.slug,
    skills: [],
    max_turns: null,
    allowed_tools: [],
    denied_tools: [],
    prompt_includes: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("formatSubagentCatalogContent", () => {
  it("returns empty for no rows", () => {
    expect(formatSubagentCatalogContent([])).toBe("");
  });

  it("lists slug and summary before skills-style heading", () => {
    const text = formatSubagentCatalogContent([
      row({ slug: "explorer", summary: "Read-only explore" }),
      row({ slug: "research", title: "调研", summary: "Structured research" }),
    ]);
    expect(text).toContain("## Subagents");
    expect(text.indexOf("prefer a **Subagent**")).toBeLessThan(text.indexOf("## Subagents"));
    expect(text).toContain("subagent_run");
    expect(text).toContain("- **explorer**: Read-only explore");
    expect(text).toContain("- **research**: Structured research");
  });
});
