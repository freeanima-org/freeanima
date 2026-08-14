import { afterAll, describe, expect, it, mock } from "bun:test";

const embeddingsCreate = mock(async ({ input }: { input: string | string[] }) => {
  const inputs = Array.isArray(input) ? input : [input];
  return {
    data: inputs.map((_, index) => ({
      index,
      embedding: [0.1, 0.2, 0.3, 0.4],
    })),
  };
});

const clientOriginal = await import("./client.ts");

mock.module("./client.ts", () => ({
  ...clientOriginal,
  createOpenAiClientFromParsed: () => ({
    embeddings: { create: embeddingsCreate },
  }),
}));

afterAll(() => {
  mock.module("./client.ts", () => clientOriginal);
});

const { createOpenAiEmbeddingBatchClient } = await import("./embedding.ts");

const cfg = {
  apiKey: "test",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "bge-m3",
  dimensions: 4,
  timeoutMs: 5000,
  queryTimeoutMs: 800,
};

describe("createOpenAiEmbeddingBatchClient", () => {
  it("returns empty for empty array", async () => {
    const embed = createOpenAiEmbeddingBatchClient(cfg);
    expect(await embed([])).toEqual([]);
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });

  it("batch input aligned by index, blank items are null", async () => {
    embeddingsCreate.mockClear();
    const embed = createOpenAiEmbeddingBatchClient(cfg);
    const out = await embed(["hello", "  ", "world"]);

    expect(embeddingsCreate).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(out[1]).toBeNull();
    expect(out[2]).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});
