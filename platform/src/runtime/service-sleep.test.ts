import { afterEach, describe, expect, it, mock } from "bun:test";
import type { CronLogAppendInput, CronLogRow } from "@freeanima/core/repos";
import { SLEEP_CYCLE_JOB_ID, sleepStepJobId } from "@freeanima/capabilities-memory";
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

function createDeps(appendRows: CronLogAppendInput[]): RuntimeDeps {
  const rows: CronLogRow[] = [];
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: {
      repos: {
        pgAvailable: true,
        cronLog: {
          append: async (row: CronLogAppendInput) => {
            appendRows.push(row);
            rows.push({
              id: rows.length,
              job_id: row.job_id,
              run_count: row.run_count,
              ok: row.ok,
              finished_at: row.finished_at ?? "",
              output: row.output ?? null,
              output_text: row.output_text ?? null,
              error: row.error ?? null,
            });
          },
          list: async () => rows,
        },
      },
    } as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describe("service-sleep cron_log", () => {
  afterEach(() => {
    runSleepCycleMock.mockClear();
    runSleepStepMock.mockClear();
  });

  it("startSleepPipelineStep appends sleep-step job_id", async () => {
    const appended: CronLogAppendInput[] = [];
    const deps = createDeps(appended);
    const { startSleepPipelineStep } = await import("./service-sleep.ts");

    const result = await startSleepPipelineStep(deps, {
      stepId: "light-sleep",
      day: "2026-06-14",
    });

    expect(result.ok).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.job_id).toBe(sleepStepJobId("light-sleep"));
    expect(appended[0]?.ok).toBe(true);
    expect(appended[0]?.output?.source).toBe("manual");
    expect(appended[0]?.output?.step_id).toBe("light-sleep");
    expect(appended[0]?.output?.day).toBe("2026-06-14");
  });

  it("startSleepCycle appends builtin-sleep-cycle after async run", async () => {
    const appended: CronLogAppendInput[] = [];
    const deps = createDeps(appended);
    const { startSleepCycle } = await import("./service-sleep.ts");

    const started = await startSleepCycle(deps, { day: "2026-06-14" });
    expect(started.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(runSleepCycleMock).toHaveBeenCalled();
    expect(appended).toHaveLength(1);
    expect(appended[0]?.job_id).toBe(SLEEP_CYCLE_JOB_ID);
    expect(appended[0]?.output?.source).toBe("manual");
    expect(appended[0]?.output?.day).toBe("2026-06-14");
  });

  it("skips cron_log append when PG unavailable", async () => {
    const appended: CronLogAppendInput[] = [];
    const base = createDeps(appended);
    const deps: RuntimeDeps = {
      ...base,
      engine: {
        ...base.engine,
        repos: {
          ...base.engine.repos,
          pgAvailable: false,
        },
      } as RuntimeDeps["engine"],
    };
    const { startSleepPipelineStep } = await import("./service-sleep.ts");

    await startSleepPipelineStep(deps, { stepId: "light-sleep" });

    expect(appended).toHaveLength(0);
  });
});

describe("sleepStepJobId", () => {
  it("prefixes step id", () => {
    expect(sleepStepJobId("deep-sleep")).toBe("sleep-step:deep-sleep");
  });
});
