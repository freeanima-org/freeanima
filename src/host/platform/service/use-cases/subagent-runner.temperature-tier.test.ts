import { describe, expect, it } from "bun:test";

import type { ResolvedSubagentProfile } from "@freeanima/features/subagent/domain/types.ts";

import { resolveTemperatureTier } from "./subagent-runner.ts";
import type { FullRuntimeDeps } from "../runtime-deps.ts";

function profile(partial: Partial<ResolvedSubagentProfile> = {}): ResolvedSubagentProfile {
  return {
    kind: "named",
    id: 1,
    slug: "general",
    title: "General",
    summary: "",
    content: "",
    skills: [],
    max_turns: null,
    temperature_tier: null,
    allowed_tools: [],
    denied_tools: [],
    prompt_includes: [],
    world_id: 1,
    ...partial,
  };
}

function depsWithTier(tier?: string): FullRuntimeDeps {
  return {
    engine: {
      config: {
        data: {
          auto_llm: tier ? { subagent: { temperature_tier: tier } } : {},
        },
      },
    },
  } as unknown as FullRuntimeDeps;
}

describe("resolveTemperatureTier", () => {
  it("defaults to balanced", () => {
    expect(resolveTemperatureTier(depsWithTier(), profile())).toBe("balanced");
  });

  it("prefers run override over profile and config", () => {
    expect(
      resolveTemperatureTier(
        depsWithTier("creative"),
        profile({ temperature_tier: "focused" }),
        "creative",
      ),
    ).toBe("creative");
  });

  it("prefers profile over config", () => {
    expect(
      resolveTemperatureTier(depsWithTier("creative"), profile({ temperature_tier: "focused" })),
    ).toBe("focused");
  });

  it("uses config when profile unset", () => {
    expect(resolveTemperatureTier(depsWithTier("creative"), profile())).toBe("creative");
  });
});
