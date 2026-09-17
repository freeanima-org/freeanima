import type { CronJob } from "@freeanima/capabilities/connectors/cron/models";

import { platformPorts } from "./service.ts";

export type CronNotifyPayload = {
  jobName: string;
  success: boolean;
  output: string;
  error?: string;
};

export type CronNotifyFn = (job: CronJob, payload: CronNotifyPayload) => Promise<void>;

/** 失败始终通知；成功仅当 job.notify_on_success 为 true */
export function shouldNotifyCronJobResult(
  job: Pick<CronJob, "notify_on_success">,
  success: boolean,
): boolean {
  return !success || job.notify_on_success;
}

/** Composition root binds the implementation onto `ctx.platformPorts`. */
export function registerCronNotify(fn: CronNotifyFn): void {
  platformPorts().cronNotify = fn;
}

export function unregisterCronNotify(): void {
  platformPorts().cronNotify = null;
}

export async function notifyCronResult(job: CronJob, payload: CronNotifyPayload): Promise<void> {
  const fn = platformPorts().cronNotify;
  if (!fn) return;
  await fn(job, payload);
}

export function formatCronNotificationText(
  job: CronJob,
  payload: CronNotifyPayload,
): {
  title: string;
  body: string;
} {
  if (payload.success) {
    return {
      title: `Cron: ${job.name}`,
      body: payload.output || `Cron job '${job.name}' completed`,
    };
  }
  const err = payload.error ?? payload.output;
  return {
    title: `Cron failed: ${job.name}`,
    body: `Cron job '${job.name}' failed:\n${err}`,
  };
}

/** 进程内 builtin（无 cron_log）失败 → Inbox；由 composition root 绑定 */
export type InprocessBuiltinFailurePayload = {
  id: string;
  name: string;
  error: string;
  run_count: number;
};

export type InprocessBuiltinFailureNotifyFn = (
  payload: InprocessBuiltinFailurePayload,
) => Promise<void>;

export function registerInprocessBuiltinFailureNotify(fn: InprocessBuiltinFailureNotifyFn): void {
  platformPorts().inprocessFailureNotify = fn;
}

export function unregisterInprocessBuiltinFailureNotify(): void {
  platformPorts().inprocessFailureNotify = null;
}

export async function notifyInprocessBuiltinFailure(
  payload: InprocessBuiltinFailurePayload,
): Promise<void> {
  const fn = platformPorts().inprocessFailureNotify;
  if (!fn) return;
  await fn(payload);
}

export function formatInprocessBuiltinFailureText(payload: InprocessBuiltinFailurePayload): {
  title: string;
  body: string;
} {
  return {
    title: `Builtin failed: ${payload.name}`,
    body: `In-process builtin '${payload.id}' failed:\n${payload.error}`,
  };
}
