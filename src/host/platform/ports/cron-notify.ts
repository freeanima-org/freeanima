import type { CronJob } from "@freeanima/host/capabilities/connectors/cron/models";

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

let notifyImpl: CronNotifyFn | null = null;

export function registerCronNotify(fn: CronNotifyFn): void {
  notifyImpl = fn;
}

export function unregisterCronNotify(): void {
  notifyImpl = null;
}

export async function notifyCronResult(job: CronJob, payload: CronNotifyPayload): Promise<void> {
  if (!notifyImpl) return;
  await notifyImpl(job, payload);
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

/** 进程内 builtin（无 cron_log）失败 → Inbox；由 platform bind 到 notifyBothRecipients */
export type InprocessBuiltinFailurePayload = {
  id: string;
  name: string;
  error: string;
  run_count: number;
};

export type InprocessBuiltinFailureNotifyFn = (
  payload: InprocessBuiltinFailurePayload,
) => Promise<void>;

let inprocessFailureNotify: InprocessBuiltinFailureNotifyFn | null = null;

export function registerInprocessBuiltinFailureNotify(fn: InprocessBuiltinFailureNotifyFn): void {
  inprocessFailureNotify = fn;
}

export function unregisterInprocessBuiltinFailureNotify(): void {
  inprocessFailureNotify = null;
}

export async function notifyInprocessBuiltinFailure(
  payload: InprocessBuiltinFailurePayload,
): Promise<void> {
  if (!inprocessFailureNotify) return;
  await inprocessFailureNotify(payload);
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
