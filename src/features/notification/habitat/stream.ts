import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import {
  watchUserNotificationCreated,
  type UserNotificationCreatedPayload,
} from "./user-inbox-events.ts";

async function* bridgeUserNotificationCreated(
  signal: AbortSignal,
): AsyncGenerator<{ method: string; payload: Record<string, unknown> }> {
  const queue: UserNotificationCreatedPayload[] = [];
  let wake: (() => void) | null = null;
  const unwatch = watchUserNotificationCreated((payload) => {
    queue.push(payload);
    wake?.();
    wake = null;
  });
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
        method: "notification.created",
        payload: {
          id: payload.id,
          title: payload.title,
          body: payload.body,
          created_at: payload.created_at,
        },
      };
    }
  } finally {
    unwatch();
  }
}

export async function pumpUserNotificationInbox(
  ctx: RemoteToolsRequestContext,
  signal: AbortSignal,
): Promise<void> {
  for await (const mapped of bridgeUserNotificationCreated(signal)) {
    if (signal.aborted) break;
    ctx.sendEvent(mapped.method, mapped.payload);
  }
}
