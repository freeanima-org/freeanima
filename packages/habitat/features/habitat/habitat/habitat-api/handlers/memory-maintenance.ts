import { omitUndefined } from "@freeanima/habitat/core/util";
import { habitatCtx } from "./runtime.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getMemoryMaintenanceSummary() {
  return habitatCtx().getMemoryMaintenanceSummary();
}

export async function listCronLogs(opts?: {
  job_id?: string;
  limit?: number;
  offset?: number;
  ok?: boolean;
}) {
  return habitatCtx().listCronLogs(opts);
}

export function getMemoryMaintenanceStatus() {
  return habitatCtx().getMemoryMaintenanceStatus();
}

export async function startMemoryMaintenanceCycle(body?: {
  day?: string;
  reflect_mode?: "full" | "incremental";
}) {
  const result = await habitatCtx().startMemoryMaintenanceCycle(
    omitUndefined({
      day: body?.day,
      reflect_mode: body?.reflect_mode,
    }),
  );
  if (!result.ok) {
    throw new ApiHandlerError(503, result.error, { code: "memory_maintenance_busy" });
  }
  return result;
}

export async function startMemoryMaintenanceStep(body: {
  step_id: string;
  day?: string;
  force?: boolean;
  reflect_mode?: "full" | "incremental";
  agent_subject_id?: number;
}) {
  const result = await habitatCtx().startMemoryMaintenanceStep(
    omitUndefined({
      stepId: body.step_id,
      day: body.day,
      force: body.force,
      reflect_mode: body.reflect_mode,
      agent_subject_id: body.agent_subject_id,
    }),
  );
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error, { code: "memory_maintenance_step_failed" });
  }
  return result;
}

export async function startMemoryMaintenanceCatchUp(body?: { agent_subject_id?: number }) {
  const result = await habitatCtx().startMemoryMaintenanceCatchUp(
    omitUndefined({ agent_subject_id: body?.agent_subject_id }),
  );
  if (!result.ok) {
    throw new ApiHandlerError(400, result.error, { code: "memory_maintenance_catch_up_failed" });
  }
  return result;
}
