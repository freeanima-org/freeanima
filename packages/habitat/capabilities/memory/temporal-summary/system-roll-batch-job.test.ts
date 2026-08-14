import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  getTemporalSystemRollBatchJobStatus,
  resetTemporalSystemRollBatchJobForTest,
  startTemporalSystemRollBatchJob,
  type TemporalSystemRollBatchLock,
} from "./system-roll-batch-job.ts";

afterEach(() => {
  resetTemporalSystemRollBatchJobForTest();
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("temporal-summary system-roll-batch-job", () => {
  it("串行完成 kinds，失败后继续", async () => {
    const regenerateOne = mock(async (kind: string) => {
      await delay(5);
      if (kind === "past_months") throw new Error("roll boom");
      return { ok: true, summary: "ok" };
    });
    const withLock: TemporalSystemRollBatchLock = async (fn) => ({
      status: "ok",
      value: await fn(),
    });

    startTemporalSystemRollBatchJob({
      kinds: ["past_days", "past_months", "past_years"],
      regenerateOne,
      withLock,
    });

    await delay(80);
    const done = getTemporalSystemRollBatchJobStatus();
    expect(done.running).toBe(false);
    expect(done.completed).toEqual(["past_days", "past_years"]);
    expect(done.failed).toEqual([{ kind: "past_months", summary: "roll boom" }]);
  });
});
