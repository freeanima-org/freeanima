import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  watchTaskAdvanceReminder,
  type TaskAdvanceReminderPayload,
} from "@freeanima/host/platform/boot/task-advance-reminder-events.ts";

async function* bridgeTaskAdvanceReminder(
  signal: AbortSignal,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  const queue: TaskAdvanceReminderPayload[] = [];
  let wake: (() => void) | null = null;
  const kick = (): void => {
    wake?.();
    wake = null;
  };
  const unwatch = watchTaskAdvanceReminder((payload) => {
    queue.push(payload);
    kick();
  });
  const onAbort = (): void => {
    kick();
  };
  signal.addEventListener("abort", onAbort);
  try {
    while (!signal.aborted) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      if (signal.aborted) break;
      const payload = queue.shift();
      if (!payload) continue;
      yield {
        method: "task.advanceReminder",
        payload: {
          task_item_id: payload.task_item_id,
          title: payload.title,
          body: payload.body,
          at: payload.at,
          source_ref: payload.source_ref,
        },
      };
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    unwatch();
  }
}

export async function pumpTaskAdvanceReminders(
  ctx: RemoteToolsRequestContext,
  signal: AbortSignal,
): Promise<void> {
  for await (const mapped of bridgeTaskAdvanceReminder(signal)) {
    if (signal.aborted) break;
    ctx.sendEvent(mapped.method, mapped.payload);
  }
}
