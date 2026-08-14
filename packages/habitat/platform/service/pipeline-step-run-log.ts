import type { PipelineStepFinishedEvent } from "@freeanima/habitat/engine/pipeline";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { appendPipelineStepRun } from "@freeanima/habitat/core/db/pg/pipeline";
import { formatCstIso } from "@freeanima/habitat/core/util";
import { getPipelineRunner } from "@freeanima/habitat/engine/pipeline";

import { MEMORY_MAINTENANCE_PIPELINE_ID } from "../boot/sleep-cycle.ts";

function outputToRecord(output: unknown): Record<string, unknown> | null {
  if (output == null) return null;
  if (typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }
  return { value: output };
}

/** 注册 memory-maintenance 流水线节点执行持久化 */
export function registerSleepPipelineStepRecorder(): void {
  const runner = getPipelineRunner();
  runner.setStepFinishedListener(async (event: PipelineStepFinishedEvent) => {
    if (event.pipeline_id !== MEMORY_MAINTENANCE_PIPELINE_ID) return;
    if (!isPostgresPrimary()) return;

    const day = event.day?.trim();
    if (!day) return;

    await appendPipelineStepRun({
      pipeline_id: event.pipeline_id,
      run_id: event.run_id,
      step_id: event.step_id,
      day,
      trigger: event.trigger ?? "manual_cycle",
      status: event.status,
      started_at: event.started_at ?? null,
      finished_at: event.finished_at ?? formatCstIso(),
      output: outputToRecord(event.output),
      error: event.error ?? null,
      skipped_reason: event.skipped_reason ?? null,
    });
  });
}

/** 测试用：移除 listener */
export function clearSleepPipelineStepRecorder(): void {
  getPipelineRunner().setStepFinishedListener(null);
}
