import { describe, expect, it } from "bun:test";

import type { RuntimeConfig } from "./runtime-config.ts";
import { resolvePassiveRecallConfig } from "./memory-config.ts";

const base = {
  llm: {
    default_profile: "chat",
    providers: {},
    profiles: {},
  },
} as RuntimeConfig;

describe("resolvePassiveRecallConfig", () => {
  it("returns defaults when passive_recall unset", () => {
    expect(resolvePassiveRecallConfig(base)).toEqual({
      enabled: true,
      limit: 5,
      min_score: 0.016,
      min_relative_score: 0.55,
      max_chars: 2000,
      exclude_resident: true,
      use_vector: false,
    });
  });

  it("defaults use_vector true when embedding model configured", () => {
    expect(
      resolvePassiveRecallConfig({
        ...base,
        embedding: { model: "nomic-embed-text" },
      }).use_vector,
    ).toBe(true);
  });

  it("merges explicit passive_recall settings", () => {
    expect(
      resolvePassiveRecallConfig({
        ...base,
        embedding: { model: "nomic-embed-text" },
        memory: {
          passive_recall: {
            enabled: false,
            limit: 3,
            min_score: 0.1,
            min_relative_score: 0.7,
            max_chars: 500,
            exclude_resident: false,
            use_vector: false,
          },
        },
      }),
    ).toEqual({
      enabled: false,
      limit: 3,
      min_score: 0.1,
      min_relative_score: 0.7,
      max_chars: 500,
      exclude_resident: false,
      use_vector: false,
    });
  });
});
