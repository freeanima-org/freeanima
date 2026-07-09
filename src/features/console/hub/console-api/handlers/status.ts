import { evaluateHealthAuthed } from "../health-auth.ts";
import { consoleCtx } from "./runtime.ts";
import { scheduleServiceRestart } from "../service-restart.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getHealthProbe(request: Request) {
  const ctx = consoleCtx();
  const base = ctx.health();
  const authed = await evaluateHealthAuthed(request);
  return { ...base, authed };
}

export async function getStatus() {
  const ctx = consoleCtx();
  return ctx.buildStatus(ctx.host, ctx.port);
}

export function listTools(scope?: "default" | "all") {
  return consoleCtx().listToolsApi(scope);
}

export async function listCronJobs() {
  return { jobs: (await consoleCtx().listCronJobs()).jobs };
}

export async function pauseCronJob(id: string) {
  const job = await consoleCtx().pauseCronJob(id);
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
  const job = await consoleCtx().resumeCronJob(id);
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
  const result = await consoleCtx().runCronJobNow(id);
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
