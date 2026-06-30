import { afterEach, describe, expect, it } from "bun:test";

import {
  fetchWorldContext,
  resetWorldContextCacheForTest,
  type ResolvedWorldContext,
} from "./world-context.ts";

const sample: ResolvedWorldContext = {
  user_subject_id: 1,
  agent_subject_id: 2,
  user_world_id: 10,
  agent_world_id: 20,
};

describe("fetchWorldContext", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetWorldContextCacheForTest();
  });

  it("loads and caches boot-time context from Hub REST", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify(sample), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(fetchWorldContext()).resolves.toEqual(sample);
    await expect(fetchWorldContext()).resolves.toEqual(sample);
    expect(calls).toBe(1);
  });

  it("throws when Hub REST fails", async () => {
    globalThis.fetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;

    await expect(fetchWorldContext()).rejects.toThrow(/failed to load world context/);
  });
});
