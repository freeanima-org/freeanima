import { evaluateHealthAuthed, resolveRemoteAddressFromRequest } from "../health-auth.ts";
import { adminCtx } from "./runtime.ts";
import { scheduleServiceRestart } from "../service-restart.ts";
import { ApiHandlerError } from "./errors.ts";

export async function getHealthProbe(request: Request) {
  const ctx = adminCtx();
  const base = ctx.health();
  const cfg = ctx.engine.config.data;
  const authed = evaluateHealthAuthed(request, resolveRemoteAddressFromRequest(request), {
    remoteAuth: cfg.remote_auth,
  });
  return { ...base, authed };
}

export async function getStatus() {
  const ctx = adminCtx();
  return ctx.buildStatus(ctx.host, ctx.port);
}

export function getConfig() {
  return adminCtx().getConfig().config;
}

export function listTools(scope?: "default" | "all") {
  return adminCtx().listToolsApi(scope);
}

export async function listCronJobs() {
  return { jobs: (await adminCtx().listCronJobs()).jobs };
}

export async function pauseCronJob(id: string) {
  const job = await adminCtx().pauseCronJob(id);
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
  const job = await adminCtx().resumeCronJob(id);
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
  const result = await adminCtx().runCronJobNow(id);
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
