import { describe, expect, it } from "bun:test";

import type { RuntimeConfig } from "./runtime-config.ts";
import {
  DEFAULT_CLUSTERING_EPS,
  DEFAULT_CLUSTERING_MAX_CALIBRATE_N,
  resolveMemoryClusteringConfig,
  resolveMemoryReferenceConfig,
  resolveMemoryResidentConfig,
  resolvePassiveRecallConfig,
} from "./memory-config.ts";

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

describe("resolveMemoryClusteringConfig", () => {
  it("disabled by default without embedding", () => {
    expect(resolveMemoryClusteringConfig(base).enabled).toBe(false);
  });

  it("enabled when embedding configured", () => {
    const resolved = resolveMemoryClusteringConfig({
      ...base,
      embedding: { model: "bge-m3" },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.eps).toBe(DEFAULT_CLUSTERING_EPS);
    expect(resolved.max_calibrate_n).toBe(DEFAULT_CLUSTERING_MAX_CALIBRATE_N);
  });

  it("respects explicit overrides", () => {
    expect(
      resolveMemoryClusteringConfig({
        ...base,
        embedding: { model: "bge-m3" },
        memory: {
          clustering: {
            enabled: false,
            eps: 0.2,
            min_points: 4,
            min_samples: 2,
            peel_small: true,
            max_calibrate_n: 1000,
          },
        },
      }),
    ).toMatchObject({
      enabled: false,
      eps: 0.2,
      min_points: 4,
      min_samples: 2,
      peel_small: true,
      max_calibrate_n: 1000,
    });
  });

  it("prefers top-level passive_recall / semantic_clustering", () => {
    expect(
      resolvePassiveRecallConfig({
        ...base,
        memory: { passive_recall: { limit: 9 } },
        passive_recall: { limit: 3 },
      }),
    ).toMatchObject({ limit: 3 });
    expect(
      resolveMemoryClusteringConfig({
        ...base,
        embedding: { model: "bge-m3" },
        memory: { clustering: { eps: 0.5 } },
        semantic_clustering: { eps: 0.2, peel_small: true },
      }),
    ).toMatchObject({ eps: 0.2, peel_small: true });
  });

  it("defaults peel_small false and min_samples to min_points-1", () => {
    const resolved = resolveMemoryClusteringConfig({
      ...base,
      embedding: { model: "bge-m3" },
    });
    expect(resolved.peel_small).toBe(false);
    expect(resolved.min_samples).toBe(2);
  });
});

describe("resolveMemoryResidentConfig", () => {
  it("returns defaults when resident unset", () => {
    expect(resolveMemoryResidentConfig(base)).toEqual({ top_n: 20, pinned_max: 20 });
    expect(resolveMemoryResidentConfig(null)).toEqual({ top_n: 20, pinned_max: 20 });
  });

  it("merges explicit resident settings", () => {
    expect(
      resolveMemoryResidentConfig({
        ...base,
        memory: { resident: { top_n: 8, pinned_max: 12 } },
      }),
    ).toEqual({ top_n: 8, pinned_max: 12 });
  });
});

describe("resolveMemoryReferenceConfig", () => {
  it("returns defaults when reference unset", () => {
    expect(resolveMemoryReferenceConfig(base)).toEqual({
      decay_days: 30,
      recent_weight: 2,
      stale_weight: 1,
    });
  });

  it("merges explicit reference settings", () => {
    expect(
      resolveMemoryReferenceConfig({
        ...base,
        memory: { reference: { decay_days: 7, recent_weight: 3, stale_weight: 1 } },
      }),
    ).toEqual({ decay_days: 7, recent_weight: 3, stale_weight: 1 });
  });
});
