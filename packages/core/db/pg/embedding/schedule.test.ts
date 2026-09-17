import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import type { EmbeddingPendingJob } from "./types.ts";

const embedAndStoreJobsMock = mock(async (_jobs: EmbeddingPendingJob[]) => 0);

const embedJobsOriginal = await import("./embed-jobs.ts");

mock.module("./embed-jobs.ts", () => ({
  ...embedJobsOriginal,
  embedAndStoreJobs: embedAndStoreJobsMock,
}));

afterAll(() => {
  mock.module("./embed-jobs.ts", () => embedJobsOriginal);
});

const {
  awaitPendingEmbeddingsForTest,
  resetPendingEmbeddingsForTest,
  scheduleAutobiographicalMemoryEmbedding,
  scheduleLimbicMemoryEmbedding,
  scheduleMessageEmbedding,
  scheduleSemanticMemoryEmbedding,
} = await import("./schedule.ts");

describe("schedule embedding", () => {
  beforeEach(() => {
    resetPendingEmbeddingsForTest();
    embedAndStoreJobsMock.mockClear();
  });

  afterEach(() => {
    resetPendingEmbeddingsForTest();
  });

  it("batches rapid schedules into one flush", async () => {
    scheduleMessageEmbedding("m1", "alpha");
    scheduleMessageEmbedding("m2", "beta");
    await awaitPendingEmbeddingsForTest();

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(1);
    const jobs = embedAndStoreJobsMock.mock.calls[0]![0];
    expect(jobs.map((j) => j.id).toSorted()).toEqual(["m1", "m2"]);
  });

  it("rapid writes for same id keep all contents in one batch", async () => {
    scheduleSemanticMemoryEmbedding("s1", "old");
    scheduleSemanticMemoryEmbedding("s1", "new");
    await awaitPendingEmbeddingsForTest();

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(1);
    const jobs = embedAndStoreJobsMock.mock.calls[0]![0];
    expect(jobs.map((j) => j.content)).toEqual(["old", "new"]);
  });

  it("blank content not scheduled", async () => {
    scheduleMessageEmbedding("m1", "   ");
    await awaitPendingEmbeddingsForTest();
    expect(embedAndStoreJobsMock).not.toHaveBeenCalled();
  });

  it("schedules limbic and autobiographical kinds", async () => {
    scheduleLimbicMemoryEmbedding("lm-1", "feeling");
    scheduleAutobiographicalMemoryEmbedding("ab-1", "title\nbody");
    await awaitPendingEmbeddingsForTest();

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(1);
    const jobs = embedAndStoreJobsMock.mock.calls[0]![0];
    expect(jobs.map((j) => j.kind).toSorted()).toEqual([
      "autobiographical_memory",
      "limbic_memory",
    ]);
  });
});
