import { describe, expect, it } from "bun:test";

import type { AnimaConfig } from "./schemas/config.ts";
import {
  DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS,
  getEmbeddingQueryTimeoutMs,
  getResolvedEmbeddingConfig,
} from "./embedding-helpers.ts";

const base = {
  llm: {
    default_profile: "chat",
    providers: {},
    profiles: {},
  },
} as AnimaConfig;

describe("embedding query timeout config", () => {
  it("defaults query timeout to 800ms", () => {
    expect(getEmbeddingQueryTimeoutMs(base)).toBe(DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS);
    expect(DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS).toBe(800);
  });

  it("respects embedding.query_timeout_ms", () => {
    expect(
      getEmbeddingQueryTimeoutMs({
        ...base,
        embedding: { query_timeout_ms: 1200 },
      }),
    ).toBe(1200);
  });

  it("includes queryTimeoutMs on resolved embedding config", () => {
    const resolved = getResolvedEmbeddingConfig({
      ...base,
      embedding: { model: "bge-m3", query_timeout_ms: 900 },
    });
    expect(resolved?.queryTimeoutMs).toBe(900);
    expect(resolved?.timeoutMs).toBe(60_000);
  });
});
