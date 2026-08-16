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
    max_loop_iterations: null,
    temperature_tier: null,
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

  it("lists slug and summary inside subagents XML with strategy prose", () => {
    const text = formatSubagentCatalogContent([
      row({ slug: "explorer", summary: "Read-only explore" }),
      row({ slug: "research", title: "调研", summary: "Structured research" }),
    ]);
    // Body only here; fold adds <subagents>. Content must include both strategy paragraphs.
    expect(text).toContain("prefer a **Subagent**");
    expect(text).toContain("Named in-process subagent profiles");
    expect(text).toContain("subagent_run");
    expect(text).toContain("- **explorer**: Read-only explore");
    expect(text).toContain("- **research**: Structured research");
    expect(text.indexOf("prefer a **Subagent**")).toBeLessThan(text.indexOf("- **explorer**"));
  });
});
