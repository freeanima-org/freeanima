import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import type {
  PipelineStepRunAppendInput,
  PipelineStepRunRow,
} from "@freeanima/habitat/core/db/pg/pipeline/types";
import {
  registerSoftFailureNotify,
  unregisterSoftFailureNotify,
} from "@freeanima/habitat/core/soft-failure";
import type { RuntimeDeps } from "./runtime-deps.ts";

// 先捕获真实实现，mock 后在 afterAll 恢复，避免 mock.module 全局泄漏污染其他测试文件。
const realPg = await import("@freeanima/habitat/core/db/pg");
const pgOriginal = { ...realPg };
const realPipeline = await import("@freeanima/habitat/core/db/pg/pipeline");
const pipelineOriginal = { ...realPipeline };
const realPipelineHandlers = await import("../boot/pipeline-handlers.ts");
const pipelineHandlersOriginal = { ...realPipelineHandlers };

const runSleepCycleMock = mock(async () => ({
  ok: true,
  pipeline_id: "sleep-cycle",
  run_id: "test-run",
  day: "2026-06-14",
  status: "completed" as const,
  steps: {
    "light-sleep": { status: "completed" as const },
  },
}));

const runSleepStepMock = mock(async () => ({
  ok: true,
  step_id: "light-sleep",
  status: "completed" as const,
  output: { ok: true, day: "2026-06-14", tool_calls: 3, sessions: 1 },
}));

const pipelineRows: PipelineStepRunRow[] = [];
const appendPipelineStepRunMock = mock(async (row: PipelineStepRunAppendInput) => {
  pipelineRows.push({
    id: pipelineRows.length + 1,
    pipeline_id: row.pipeline_id,
    run_id: row.run_id,
    step_id: row.step_id,
    attempt: pipelineRows.filter((r) => r.run_id === row.run_id && r.step_id === row.step_id)
      .length,
    day: row.day,
    trigger: row.trigger,
    status: row.status,
    started_at: row.started_at ?? null,
    finished_at: row.finished_at ?? "",
    output: row.output ?? null,
    error: row.error ?? null,
    skipped_reason: row.skipped_reason ?? null,
  });
});

mock.module("@freeanima/habitat/core/db/pg", () => ({
  ...pgOriginal,
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/habitat/core/db/pg/pipeline", () => ({
  ...pipelineOriginal,
  appendPipelineStepRun: appendPipelineStepRunMock,
  listPipelineStepRuns: mock(async () => pipelineRows),
  listCompletedStepDays: mock(async () => []),
}));

mock.module("../boot/pipeline-handlers.ts", () => ({
  ...pipelineHandlersOriginal,
  resolveSleepCycleDay: (day?: string) => day?.trim() || "2026-06-14",
  runSleepCycle: runSleepCycleMock,
  runSleepStep: runSleepStepMock,
  getSleepPipelineStatus: () => null,
  registerSleepPipeline: () => {},
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg", () => pgOriginal);
  mock.module("@freeanima/habitat/core/db/pg/pipeline", () => pipelineOriginal);
  mock.module("../boot/pipeline-handlers.ts", () => pipelineHandlersOriginal);
});

function createDeps(): RuntimeDeps {
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: {} as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describe("service-sleep pipeline runs", () => {
  afterEach(() => {
    runSleepCycleMock.mockClear();
    runSleepStepMock.mockClear();
    appendPipelineStepRunMock.mockClear();
    pipelineRows.length = 0;
    unregisterSoftFailureNotify();
  });

  it("startSleepPipelineStep does not write cron_log", async () => {
    const deps = createDeps();
    const { startSleepPipelineStep } = await import("./service-sleep.ts");

    const result = await startSleepPipelineStep(deps, {
      stepId: "light-sleep",
      day: "2026-06-14",
    });

    expect(result.ok).toBe(true);
    expect(appendPipelineStepRunMock).not.toHaveBeenCalled();
    expect(runSleepStepMock).toHaveBeenCalled();
  });

  it("startSleepCycle does not write cron_log", async () => {
    const deps = createDeps();
    const { startSleepCycle } = await import("./service-sleep.ts");

    const started = await startSleepCycle(deps, { day: "2026-06-14" });
    expect(started.ok).toBe(true);

    await new Promise((r) => {
      setTimeout(r, 50);
    });

    expect(runSleepCycleMock).toHaveBeenCalled();
    expect(appendPipelineStepRunMock).not.toHaveBeenCalled();
  });

  it("startSleepCatchUp runs light-sleep with catch_up trigger", async () => {
    const deps = createDeps();
    const { startSleepCatchUp, getSleepPipelineStatus } = await import("./service-sleep.ts");

    const plan = {
      start: "2026-06-01",
      end: "2026-06-14",
      light_days: ["2026-06-10"],
      temporal_days: [] as string[],
      cascade_days: [] as string[],
      days: ["2026-06-10"],
    };
    const started = await startSleepCatchUp(deps, { plan });
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.plan.light_days).toEqual(["2026-06-10"]);
    }

    await new Promise((r) => {
      setTimeout(r, 80);
    });

    expect(runSleepStepMock).toHaveBeenCalledWith(
      "light-sleep",
      expect.objectContaining({
        day: "2026-06-10",
        force: true,
        trigger: "catch_up",
      }),
    );
    expect(getSleepPipelineStatus().catch_up.finished).toBe(true);
  });

  it("startSleepCatchUp failure notifies soft-failure Inbox", async () => {
    const refs: string[] = [];
    registerSoftFailureNotify(async (input) => {
      refs.push(input.sourceRef);
      return "notified";
    });
    runSleepStepMock.mockImplementationOnce(async () => {
      throw new Error("light-sleep boom");
    });

    const deps = createDeps();
    const { startSleepCatchUp, getSleepPipelineStatus } = await import("./service-sleep.ts");
    const plan = {
      start: "2026-06-01",
      end: "2026-06-14",
      light_days: ["2026-06-10"],
      temporal_days: [] as string[],
      cascade_days: [] as string[],
      days: ["2026-06-10"],
    };
    await startSleepCatchUp(deps, { plan });
    await new Promise((r) => {
      setTimeout(r, 80);
    });

    expect(getSleepPipelineStatus().catch_up.error).toContain("light-sleep boom");
    expect(refs.some((r) => r.startsWith("sleep:catch_up_failed:"))).toBe(true);
  });

  it("listPipelineStepRuns returns rows from store", async () => {
    const deps = createDeps();
    const { appendPipelineStepRun } = await import("@freeanima/habitat/core/db/pg/pipeline");
    await appendPipelineStepRun({
      pipeline_id: "sleep-cycle",
      run_id: "r1",
      step_id: "light-sleep",
      day: "2026-06-14",
      trigger: "manual_step",
      status: "completed",
      finished_at: "2026-06-14T10:00:00+08:00",
      output: { tool_calls: 2 },
    });

    const { listPipelineStepRuns } = await import("./service-sleep.ts");
    const result = await listPipelineStepRuns(deps, { limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.step_id).toBe("light-sleep");
  });
});
