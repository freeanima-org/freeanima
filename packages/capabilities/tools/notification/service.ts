import { Service, type Context } from "cordis";
import { setNotificationPort, type NotificationPort } from "./port.ts";

declare module "cordis" {
  interface Context {
    notifications: NotificationService;
  }
}

export type NotificationServiceConfig = {
  port: NotificationPort;
};

/**
 * Cordis service exposing the notification port as `ctx.notifications`.
 *
 * Mounted by the composition root; 端口同时登记到 `port.ts`，供没有 ctx 的深层
 * 消费者（`getNotificationPort()`）取用。
 */
export class NotificationService extends Service {
  port: NotificationPort;

  constructor(ctx: Context, config: NotificationServiceConfig) {
    super(ctx, "notifications");
    this.port = config.port;
    setNotificationPort(this.port);
    ctx.effect(() => () => {
      if (this.port === config.port) setNotificationPort(null);
    });
  }

  setPort(port: NotificationPort): void {
    this.port = port;
    setNotificationPort(port);
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the instance and swaps the port). */
export function mountNotificationService(
  ctx: Context,
  port: NotificationPort,
): NotificationService {
  const existing = ctx.notifications as NotificationService | undefined;
  if (existing) {
    existing.setPort(port);
    return existing;
  }
  return new NotificationService(ctx, { port });
}
