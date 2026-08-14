import { logComponent } from "@freeanima/habitat/platform/logging";

export type CronDeliverTarget = {
  platform: string;
  chat_id: string;
  thread_id?: string;
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

export async function deliverToTargets(
  targets: CronDeliverTarget[],
  text: string,
  opts?: CronDeliverOptions,
): Promise<CronDeliverResult | void> {
  if (targets.length === 0 || !text.trim()) return;
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
