import { describe, expect, it } from "bun:test";

import {
  formatSubagentRoleSection,
  mergePromptIncludes,
  normalizePromptIncludes,
} from "./subagent-prompt.ts";
import type { ResolvedSubagentProfile } from "./types.ts";

function profile(
  partial: Partial<ResolvedSubagentProfile> &
    Pick<ResolvedSubagentProfile, "kind" | "slug" | "content">,
): ResolvedSubagentProfile {
  return {
    id: partial.id ?? (partial.kind === "named" ? 1 : null),
    title: partial.title ?? partial.slug,
    summary: partial.summary ?? "",
    skills: [],
    max_loop_iterations: null,
    temperature_tier: null,
    allowed_tools: [],
    denied_tools: [],
    prompt_includes: [],
    world_id: 1,
    ...partial,
  };
}

describe("subagent prompt helpers", () => {
  it("normalizePromptIncludes drops unknown and dedupes", () => {
    expect(normalizePromptIncludes(["self", "SELF", "nope", "time"])).toEqual(["self", "time"]);
  });

  it("mergePromptIncludes unions entity + call", () => {
    expect(mergePromptIncludes(["self"], ["world", "self"])).toEqual(["self", "world"]);
  });

  it("formatSubagentRoleSection uses content for named and ephemeral", () => {
    expect(
      formatSubagentRoleSection(
        profile({ kind: "named", slug: "explorer", content: "Read only.", summary: "Explore" }),
      ),
    ).toContain("Read only.");
    expect(
      formatSubagentRoleSection(
        profile({
          kind: "ephemeral",
          slug: "ephemeral",
          content: "Critique the plan.",
          title: "Critic",
        }),
      ),
    ).toContain("Critique the plan.");
  });
});
