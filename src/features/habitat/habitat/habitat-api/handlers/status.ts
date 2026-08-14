import { habitatCtx } from "./runtime.ts";
import { scheduleServiceRestart } from "../service-restart.ts";
import { ApiHandlerError } from "./errors.ts";
import type { ServiceAuthContext } from "../auth-context.ts";
import {
  applyServiceUpdate,
  checkServiceUpdate,
} from "@freeanima/host/core/config/app-update/service-update";
import { logComponent } from "@freeanima/host/platform/logging";

export async function getHealthProbe(auth?: ServiceAuthContext | null) {
  const ctx = habitatCtx();
  const base = ctx.health();
  const authed = auth != null && auth.token_id > 0;
  return { ...base, authed };
}

export async function getStatus() {
  const ctx = habitatCtx();
  return ctx.buildStatus(ctx.host, ctx.port);
}

export function listTools(scope?: "default" | "all") {
  return habitatCtx().listToolsApi(scope);
}

export async function listCronJobs() {
  return { jobs: (await habitatCtx().listCronJobs()).jobs };
}

export async function pauseCronJob(id: string) {
  const job = await habitatCtx().pauseCronJob(id);
  if (!job) {
    throw new ApiHandlerError(404, `Cron job not found: ${id}`, {
      job_id: id,
      code: "cron_job_not_found",
      params: { job_id: id },
    });
  }
  return { ok: true as const, job };
}

export async function resumeCronJob(id: string) {
  const job = await habitatCtx().resumeCronJob(id);
  if (!job) {
    throw new ApiHandlerError(404, `Cron job not found: ${id}`, {
      job_id: id,
      code: "cron_job_not_found",
      params: { job_id: id },
    });
  }
  return { ok: true as const, job };
}

export async function runCronJobNow(id: string) {
  const result = await habitatCtx().runCronJobNow(id);
  if (!result) {
    throw new ApiHandlerError(404, `Cron job not found: ${id}`, {
      job_id: id,
      code: "cron_job_not_found",
      params: { job_id: id },
    });
  }
  return { ok: true as const, message: result.message, job: result.job };
}

export async function createCronJob(payload: {
  name: string;
  schedule: string;
  prompt: string;
  notify_on_success?: boolean;
}) {
  try {
    const job = await habitatCtx().createCronJob(payload);
    return { ok: true as const, job };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new ApiHandlerError(400, message, {
      code: "cron_job_create_failed",
      params: { name: payload.name },
    });
  }
}

export async function deleteCronJob(id: string) {
  try {
    const ok = await habitatCtx().deleteCronJob(id);
    if (!ok) {
      throw new ApiHandlerError(404, `Cron job not found: ${id}`, {
        job_id: id,
        code: "cron_job_not_found",
        params: { job_id: id },
      });
    }
    return { ok: true as const, job_id: id };
  } catch (e) {
    if (e instanceof ApiHandlerError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    throw new ApiHandlerError(400, message, {
      job_id: id,
      code: "cron_job_delete_failed",
      params: { job_id: id },
    });
  }
}

export function restartService() {
  scheduleServiceRestart();
  return { ok: true as const, code: "service_restarting" };
}

export async function checkServiceUpdateStatus(payload?: { proxy?: string }) {
  return checkServiceUpdate({
    ...(payload?.proxy != null ? { proxy: payload.proxy } : {}),
    log: (msg) => logComponent("service-update").info(msg),
  });
}

export async function applyServiceUpdateStatus(payload?: { proxy?: string }) {
  const result = await applyServiceUpdate({
    ...(payload?.proxy != null ? { proxy: payload.proxy } : {}),
    log: (msg) => logComponent("service-update").info(msg),
  });
  if (result.ok) {
    scheduleServiceRestart();
  }
  return result;
}
