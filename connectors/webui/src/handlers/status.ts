import { getServiceContext } from "@freeanima/service-api";
import { scheduleServiceRestart } from "../service-restart.ts";
import { ApiHandlerError } from "./errors.ts";

export function getHealth() {
  const { service } = getServiceContext();
  return service.health();
}

export async function getStatus() {
  const { service, host, port } = getServiceContext();
  return service.buildStatus(host, port);
}

export function getConfig() {
  const { service } = getServiceContext();
  return service.getConfig().config;
}

export function listTools() {
  const { service } = getServiceContext();
  return service.listToolsApi();
}

export function listCronJobs() {
  const { service } = getServiceContext();
  return { jobs: service.listCronJobs().jobs };
}

export function pauseCronJob(id: string) {
  const { service } = getServiceContext();
  const job = service.pauseCronJob(id);
  if (!job) throw new ApiHandlerError(404, `未找到任务: ${id}`, { job_id: id });
  return { ok: true as const, job };
}

export function resumeCronJob(id: string) {
  const { service } = getServiceContext();
  const job = service.resumeCronJob(id);
  if (!job) throw new ApiHandlerError(404, `未找到任务: ${id}`, { job_id: id });
  return { ok: true as const, job };
}

export function runCronJobNow(id: string) {
  const { service } = getServiceContext();
  const result = service.runCronJobNow(id);
  if (!result) throw new ApiHandlerError(404, `未找到任务: ${id}`, { job_id: id });
  return { ok: true as const, message: result.message, job: result.job };
}

export function restartService() {
  scheduleServiceRestart();
  return { ok: true as const, message: "服务正在重启..." };
}
