import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import {
  registerSoftFailureNotify,
  unregisterSoftFailureNotify,
} from "@freeanima/habitat/core/soft-failure";
import type { RuntimeDeps } from "./runtime-deps.ts";

const realPg = await import("@freeanima/habitat/core/db/pg");
const pgOriginal = { ...realPg };
const realPipelineHandlers = await import("../boot/pipeline-handlers.ts");
const pipelineHandlersOriginal = { ...realPipelineHandlers };

const runCycleMock = mock(async () => ({
  ok: true,
  day: "2026-06-14",
  status: "completed" as const,
  steps: {
    "conversation-cleanup": {
      ok: true,
      step_id: "conversation-cleanup",
      status: "completed" as const,
    },
  },
}));

const runStepMock = mock(async () => ({
  ok: true,
  step_id: "retain-catch-up",
  status: "completed" as const,
  output: { ok: true, day: "2026-06-14", retained: 1, conversations: 1 },
}));

mock.module("@freeanima/habitat/core/db/pg", () => ({
  ...pgOriginal,
  isPostgresPrimary: () => true,
}));

mock.module("../boot/pipeline-handlers.ts", () => ({
  ...pipelineHandlersOriginal,
  resolveMemoryMaintenanceDay: (day?: string) => day?.trim() || "2026-06-14",
  runMemoryMaintenance: runCycleMock,
  runMemoryMaintenanceStep: runStepMock,
  getMemoryMaintenanceStatus: () => null,
  registerSleepPipeline: () => {},
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg", () => pgOriginal);
  mock.module("../boot/pipeline-handlers.ts", () => pipelineHandlersOriginal);
});

function createDeps(): RuntimeDeps {
  return {
    kernel: {} as RuntimeDeps["kernel"],
    engine: { config: { data: {} } } as RuntimeDeps["engine"],
    conversation: {} as RuntimeDeps["conversation"],
  };
}

describe("service-memory-maintenance", () => {
  afterEach(() => {
    runCycleMock.mockClear();
    runStepMock.mockClear();
    unregisterSoftFailureNotify();
  });

  it("startMemoryMaintenanceStep invokes step runner", async () => {
    const deps = createDeps();
    const { startMemoryMaintenanceStep } = await import("./service-memory-maintenance.ts");

    const result = await startMemoryMaintenanceStep(deps, {
      stepId: "retain-catch-up",
      day: "2026-06-14",
    });

    expect(result.ok).toBe(true);
    expect(runStepMock).toHaveBeenCalled();
  });

  it("startMemoryMaintenanceCycle starts async cycle", async () => {
    const deps = createDeps();
    const { startMemoryMaintenanceCycle } = await import("./service-memory-maintenance.ts");

    const started = await startMemoryMaintenanceCycle(deps, { day: "2026-06-14" });
    expect(started.ok).toBe(true);

    await new Promise((r) => {
      setTimeout(r, 50);
    });

    expect(runCycleMock).toHaveBeenCalled();
  });

  it("startMemoryMaintenanceCatchUp runs retain-catch-up with catch_up trigger", async () => {
    const deps = createDeps();
    const { startMemoryMaintenanceCatchUp, getMemoryMaintenanceStatus } =
      await import("./service-memory-maintenance.ts");

    const plan = {
      start: "2026-06-01",
      end: "2026-06-14",
      light_days: ["2026-06-10"],
      temporal_days: [] as string[],
      cascade_days: [] as string[],
      days: ["2026-06-10"],
    };
    const started = await startMemoryMaintenanceCatchUp(deps, { plan });
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.plan.light_days).toEqual(["2026-06-10"]);
    }

    await new Promise((r) => {
      setTimeout(r, 80);
    });

    expect(runStepMock).toHaveBeenCalledWith(
      "retain-catch-up",
      expect.objectContaining({
        day: "2026-06-10",
        force: true,
        trigger: "catch_up",
      }),
    );
    expect(getMemoryMaintenanceStatus().catch_up.finished).toBe(true);
  });

  it("startMemoryMaintenanceCatchUp failure notifies soft-failure Inbox", async () => {
    const refs: string[] = [];
    registerSoftFailureNotify(async (input) => {
      refs.push(input.sourceRef);
      return "notified";
    });
    runStepMock.mockImplementationOnce(async () => {
      throw new Error("retain-catch-up boom");
    });

    const deps = createDeps();
    const { startMemoryMaintenanceCatchUp, getMemoryMaintenanceStatus } =
      await import("./service-memory-maintenance.ts");
    const plan = {
      start: "2026-06-01",
      end: "2026-06-14",
      light_days: ["2026-06-10"],
      temporal_days: [] as string[],
      cascade_days: [] as string[],
      days: ["2026-06-10"],
    };
    await startMemoryMaintenanceCatchUp(deps, { plan });
    await new Promise((r) => {
      setTimeout(r, 80);
    });

    expect(getMemoryMaintenanceStatus().catch_up.error).toContain("retain-catch-up boom");
    expect(refs.some((r) => r.startsWith("memory_maintenance:catch_up_failed:"))).toBe(true);
  });
});
