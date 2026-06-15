import { afterEach, describe, expect, it, mock } from "bun:test";
import type { PipelineStepRunAppendInput, PipelineStepRunRow } from "@freeanima/core/repos";
import type { RuntimeDeps } from "./runtime-deps.ts";

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

mock.module("../boot/pipeline-handlers.ts", () => ({
  resolveSleepCycleDay: (day?: string) => day?.trim() || "2026-06-14",
  runSleepCycle: runSleepCycleMock,
  runSleepStep: runSleepStepMock,
  getSleepPipelineStatus: () => null,
  registerSleepPipeline: () => {},
}));

function createDeps(appended: PipelineStepRunAppendInput[]): RuntimeDeps {
  const rows: PipelineStepRunRow[] = [];
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: {
      repos: {
        pgAvailable: true,
        pipelineStepRun: {
          append: async (row: PipelineStepRunAppendInput) => {
            appended.push(row);
            rows.push({
              id: rows.length + 1,
              pipeline_id: row.pipeline_id,
              run_id: row.run_id,
              step_id: row.step_id,
              attempt: rows.filter((r) => r.run_id === row.run_id && r.step_id === row.step_id)
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
          },
          list: async () => rows,
        },
      },
    } as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describe("service-sleep pipeline runs", () => {
  afterEach(() => {
    runSleepCycleMock.mockClear();
    runSleepStepMock.mockClear();
  });

  it("startSleepPipelineStep does not write cron_log", async () => {
    const appended: PipelineStepRunAppendInput[] = [];
    const deps = createDeps(appended);
    const { startSleepPipelineStep } = await import("./service-sleep.ts");

    const result = await startSleepPipelineStep(deps, {
      stepId: "light-sleep",
      day: "2026-06-14",
    });

    expect(result.ok).toBe(true);
    expect(appended).toHaveLength(0);
    expect(runSleepStepMock).toHaveBeenCalled();
  });

  it("startSleepCycle does not write cron_log", async () => {
    const appended: PipelineStepRunAppendInput[] = [];
    const deps = createDeps(appended);
    const { startSleepCycle } = await import("./service-sleep.ts");

    const started = await startSleepCycle(deps, { day: "2026-06-14" });
    expect(started.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(runSleepCycleMock).toHaveBeenCalled();
    expect(appended).toHaveLength(0);
  });

  it("listPipelineStepRuns returns rows from store", async () => {
    const appended: PipelineStepRunAppendInput[] = [];
    const deps = createDeps(appended);
    await deps.engine.repos.pipelineStepRun.append({
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
