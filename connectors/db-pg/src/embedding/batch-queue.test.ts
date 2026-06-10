import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const embedAndStoreJobsMock = mock(async (_jobs: EmbeddingPendingJob[]) => 0);

import type { EmbeddingPendingJob } from "./types.ts";

mock.module("./embed-jobs.ts", () => ({
  embedAndStoreJobs: embedAndStoreJobsMock,
}));

import {
  enqueueEmbedding,
  flushEmbeddingQueueForTest,
  resetEmbeddingQueueForTest,
} from "./batch-queue.ts";

describe("batch-queue", () => {
  beforeEach(() => {
    resetEmbeddingQueueForTest();
    embedAndStoreJobsMock.mockClear();
  });

  afterEach(() => {
    resetEmbeddingQueueForTest();
  });

  it("flush merges multiple enqueued jobs", async () => {
    enqueueEmbedding({ kind: "message", id: "m1", content: "alpha" });
    enqueueEmbedding({ kind: "message", id: "m2", content: "beta" });
    await flushEmbeddingQueueForTest();

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(1);
    const call = embedAndStoreJobsMock.mock.calls[0];
    expect(call).toBeDefined();
    const jobs = call![0] as EmbeddingPendingJob[];
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.id).toSorted()).toEqual(["m1", "m2"]);
  });

  it("later write overwrites earlier for same kind:id", async () => {
    enqueueEmbedding({ kind: "semantic_memory", id: "s1", content: "old" });
    enqueueEmbedding({ kind: "semantic_memory", id: "s1", content: "new" });
    await flushEmbeddingQueueForTest();

    const call = embedAndStoreJobsMock.mock.calls[0];
    expect(call).toBeDefined();
    const jobs = call![0] as EmbeddingPendingJob[];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.content).toBe("new");
  });

  it("blank content not enqueued", async () => {
    enqueueEmbedding({ kind: "message", id: "m1", content: "   " });
    await flushEmbeddingQueueForTest();
    expect(embedAndStoreJobsMock).not.toHaveBeenCalled();
  });
});
