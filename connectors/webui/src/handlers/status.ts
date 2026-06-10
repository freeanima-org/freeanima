import { webuiCtx } from "./runtime.ts";
import { scheduleServiceRestart } from "../service-restart.ts";
import { ApiHandlerError } from "./errors.ts";

export function getHealth() {
  const { service } = webuiCtx();
  return service.health();
}

export async function getStatus() {
  const { service, host, port } = webuiCtx();
  return service.buildStatus(host, port);
}

export function getConfig() {
  const { service } = webuiCtx();
  return service.getConfig().config;
}

export function listTools() {
  const { service } = webuiCtx();
  return service.listToolsApi();
}

export async function listCronJobs() {
  const { service } = webuiCtx();
  return { jobs: (await service.listCronJobs()).jobs };
}

export async function pauseCronJob(id: string) {
  const { service } = webuiCtx();
  const job = await service.pauseCronJob(id);
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
  const { service } = webuiCtx();
  const job = await service.resumeCronJob(id);
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
  const { service } = webuiCtx();
  const result = await service.runCronJobNow(id);
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
