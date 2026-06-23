import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const embedAndStoreJobsMock = mock(async (_jobs: EmbeddingPendingJob[]) => 0);

import type { EmbeddingPendingJob } from "./types.ts";

mock.module("./embed-jobs.ts", () => ({
  embedAndStoreJobs: embedAndStoreJobsMock,
}));

import {
  awaitPendingEmbeddingsForTest,
  resetPendingEmbeddingsForTest,
  scheduleAutobiographicalMemoryEmbedding,
  scheduleLimbicMemoryEmbedding,
  scheduleMessageEmbedding,
  scheduleSemanticMemoryEmbedding,
} from "./schedule.ts";

describe("schedule embedding", () => {
  beforeEach(() => {
    resetPendingEmbeddingsForTest();
    embedAndStoreJobsMock.mockClear();
  });

  afterEach(() => {
    resetPendingEmbeddingsForTest();
  });

  it("schedules embed immediately per job", async () => {
    scheduleMessageEmbedding("m1", "alpha");
    scheduleMessageEmbedding("m2", "beta");
    await awaitPendingEmbeddingsForTest();

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(2);
    const ids = embedAndStoreJobsMock.mock.calls.map((call) => {
      const jobs = call![0] as EmbeddingPendingJob[];
      return jobs[0]!.id;
    });
    expect(ids.toSorted()).toEqual(["m1", "m2"]);
  });

  it("rapid writes for same id each trigger embed", async () => {
    scheduleSemanticMemoryEmbedding("s1", "old");
    scheduleSemanticMemoryEmbedding("s1", "new");
    await awaitPendingEmbeddingsForTest();

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(2);
    const contents = embedAndStoreJobsMock.mock.calls.map((call) => {
      const jobs = call![0] as EmbeddingPendingJob[];
      return jobs[0]!.content;
    });
    expect(contents).toEqual(["old", "new"]);
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

    expect(embedAndStoreJobsMock).toHaveBeenCalledTimes(2);
    const kinds = embedAndStoreJobsMock.mock.calls.map((call) => {
      const jobs = call![0] as EmbeddingPendingJob[];
      return jobs[0]!.kind;
    });
    expect(kinds.toSorted()).toEqual(["autobiographical_memory", "limbic_memory"]);
  });
});
