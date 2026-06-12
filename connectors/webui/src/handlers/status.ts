import { webuiCtx } from "./runtime.ts";
import { scheduleServiceRestart } from "../service-restart.ts";
import { ApiHandlerError } from "./errors.ts";

export function getHealth() {
  return webuiCtx().health();
}

export async function getStatus() {
  const ctx = webuiCtx();
  return ctx.buildStatus(ctx.host, ctx.port);
}

export function getConfig() {
  return webuiCtx().getConfig().config;
}

export function listTools() {
  return webuiCtx().listToolsApi();
}

export async function listCronJobs() {
  return { jobs: (await webuiCtx().listCronJobs()).jobs };
}

export async function pauseCronJob(id: string) {
  const job = await webuiCtx().pauseCronJob(id);
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
  const job = await webuiCtx().resumeCronJob(id);
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
  const result = await webuiCtx().runCronJobNow(id);
  if (!result) {
    throw new ApiHandlerError(404, `Cron job not found: ${id}`, {
      job_id: id,
      code: "cron_job_not_found",
      params: { job_id: id },
    });
  }
  return { ok: true as const, message: result.message, job: result.job };
}

export function restartService() {
  scheduleServiceRestart();
  return { ok: true as const, code: "service_restarting" };
}
