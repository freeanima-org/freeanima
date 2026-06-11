import { logComponent } from "@freeanima/service-logging";
import { getHomeChannel } from "@freeanima/service-api/home-channel";
import type { CronJob } from "./models.ts";

export type CronDeliverTarget = {
  platform: string;
  chat_id: string;
  thread_id?: string;
};

export type CronDeliverPayload = {
  jobName: string;
  success: boolean;
  output: string;
  error?: string;
};

export type CronDeliverOptions = {
  editMessageId?: string;
};

export type CronDeliverResult = {
  messageId?: string;
};

export type CronDeliverFn = (
  target: CronDeliverTarget,
  text: string,
  opts?: CronDeliverOptions,
) => Promise<CronDeliverResult | void>;

const deliverers = new Map<string, CronDeliverFn>();

export function registerCronDeliverer(platform: string, fn: CronDeliverFn): void {
  deliverers.set(platform, fn);
}

export function unregisterCronDeliverer(platform: string): void {
  deliverers.delete(platform);
}

export function resolveDeliverTargets(deliver: string): CronDeliverTarget[] {
  const trimmed = deliver.trim();
  if (!trimmed || trimmed === "local") return [];

  if (trimmed === "all") {
    const targets: CronDeliverTarget[] = [];
    for (const platform of ["discord", "weixin"]) {
      const home = getHomeChannel(platform);
      if (home) {
        targets.push({ platform, ...home });
      }
    }
    return targets;
  }

  const parts = trimmed.split(":");
  const platform = parts[0]?.toLowerCase() ?? "";
  if (platform === "discord" || platform === "weixin") {
    if (parts.length === 1) {
      const home = getHomeChannel(platform);
      return home ? [{ platform, ...home }] : [];
    }
    const chatId = parts[1]?.trim() ?? "";
    if (!chatId) return [];
    const threadId = parts[2]?.trim();
    return [{ platform, chat_id: chatId, ...(threadId ? { thread_id: threadId } : {}) }];
  }

  return [];
}

function formatDeliverText(job: CronJob, payload: CronDeliverPayload): string {
  if (payload.success) {
    return payload.output || `✅ Cron job '${job.name}' completed`;
  }
  const err = payload.error ?? payload.output;
  return `⚠️ Cron job '${job.name}' failed:\n${err}`;
}

export async function deliverToTargets(
  targets: CronDeliverTarget[],
  text: string,
  opts?: CronDeliverOptions,
): Promise<CronDeliverResult | void> {
  if (!targets.length || !text.trim()) return;
  let messageId: string | undefined;
  for (const target of targets) {
    const fn = deliverers.get(target.platform);
    if (!fn) {
      logComponent("cron-deliver").warn(
        `deliver: no handler for platform '${target.platform}' (${target.chat_id})`,
      );
      continue;
    }
    try {
      const res = await fn(target, text, opts);
      if (res?.messageId && !messageId) messageId = res.messageId;
    } catch (e) {
      logComponent("cron-deliver").error(`deliver failed (${target.platform}:${target.chat_id})`, {
        err: e,
      });
    }
  }
  return messageId ? { messageId } : undefined;
}

export async function deliverCronResult(job: CronJob, payload: CronDeliverPayload): Promise<void> {
  const targets = resolveDeliverTargets(job.deliver);
  if (!targets.length) return;

  const text = formatDeliverText(job, payload);
  await deliverToTargets(targets, text);
}
