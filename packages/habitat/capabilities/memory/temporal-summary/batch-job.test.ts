import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  getTemporalBatchJobStatus,
  resetTemporalBatchJobForTest,
  startTemporalBatchJob,
  type TemporalBatchLock,
} from "./batch-job.ts";

afterEach(() => {
  resetTemporalBatchJobForTest();
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("temporal-summary batch-job", () => {
  it("已在跑时 start 返回当前 status 且不启动第二份任务", async () => {
    let calls = 0;
    const regenerateOne = mock(async () => {
      calls += 1;
      await delay(40);
      return { ok: true, summary: "ok" };
    });
    const withLock: TemporalBatchLock = async (fn) => ({ status: "ok", value: await fn() });

    const first = startTemporalBatchJob({
      mode: "rebuild_range",
      window: "day",
      period_start_from: "2026-01-01",
      period_start_to: "2026-01-02",
      periods: ["2026-01-01", "2026-01-02"],
      regenerateOne,
      withLock,
    });
    expect(first.running).toBe(true);
    expect(first.total).toBe(2);

    const second = startTemporalBatchJob({
      mode: "backfill_missing",
      window: "month",
      period_start_from: "2026-02-01",
      period_start_to: "2026-02-01",
      periods: ["2026-02-01"],
      regenerateOne,
      withLock,
    });
    expect(second.running).toBe(true);
    expect(second.mode).toBe("rebuild_range");
    expect(second.window).toBe("day");

    await delay(120);
    const done = getTemporalBatchJobStatus();
    expect(done.running).toBe(false);
    expect(calls).toBe(2);
    expect(done.completed).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("串行更新 current / completed，失败后继续", async () => {
    const regenerateOne = mock(async ({ period_start }: { period_start: string }) => {
      await delay(5);
      if (period_start === "2026-01-02") {
        return { ok: false, summary: "llm failed" };
      }
      if (period_start === "2026-01-03") {
        throw new Error("boom");
      }
      return { ok: true, summary: "ok" };
    });
    const withLock: TemporalBatchLock = async (fn) => ({ status: "ok", value: await fn() });

    startTemporalBatchJob({
      mode: "backfill_missing",
      window: "day",
      period_start_from: "2026-01-01",
      period_start_to: "2026-01-03",
      periods: ["2026-01-01", "2026-01-02", "2026-01-03"],
      regenerateOne,
      withLock,
    });

    await delay(80);
    const done = getTemporalBatchJobStatus();
    expect(done.running).toBe(false);
    expect(done.current).toBe(3);
    expect(done.total).toBe(3);
    expect(done.completed).toEqual(["2026-01-01"]);
    expect(done.failed).toEqual([
      { period_start: "2026-01-02", summary: "llm failed" },
      { period_start: "2026-01-03", summary: "boom" },
    ]);
    expect(done.summary).toContain("filled=1");
    expect(done.summary).toContain("failed=2");
  });

  it("锁 busy 时写入 error 并结束", async () => {
    const regenerateOne = mock(async () => ({ ok: true, summary: "ok" }));
    const withLock: TemporalBatchLock = async () => ({ status: "busy" });

    const started = startTemporalBatchJob({
      mode: "rebuild_range",
      window: "day",
      period_start_from: "2026-01-01",
      period_start_to: "2026-01-01",
      periods: ["2026-01-01"],
      regenerateOne,
      withLock,
    });
    expect(started.running).toBe(true);

    await delay(20);
    const done = getTemporalBatchJobStatus();
    expect(done.running).toBe(false);
    expect(done.error).toContain("already running on another Habitat");
    expect(regenerateOne).not.toHaveBeenCalled();
  });

  it("空 periods 立即结束", () => {
    const regenerateOne = mock(async () => ({ ok: true, summary: "ok" }));
    const status = startTemporalBatchJob({
      mode: "backfill_missing",
      window: "day",
      period_start_from: "2026-01-01",
      period_start_to: "2026-01-01",
      periods: [],
      regenerateOne,
      summaryNote: " (skip)",
    });
    expect(status.running).toBe(false);
    expect(status.summary).toContain("total=0");
    expect(status.summary).toContain("(skip)");
    expect(regenerateOne).not.toHaveBeenCalled();
  });
});
