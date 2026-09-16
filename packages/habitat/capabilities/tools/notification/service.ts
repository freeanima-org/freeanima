import { Service, type Context } from "cordis";
import type { NotificationPort } from "./port.ts";

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
 * Mounted by the composition root; consumers that need ordering can depend on
 * it via `ctx.inject(['notifications'], ...)` instead of the module-global
 * `getNotificationPort()` accessor.
 */
export class NotificationService extends Service {
  readonly port: NotificationPort;

  constructor(ctx: Context, config: NotificationServiceConfig) {
    super(ctx, "notifications");
    this.port = config.port;
  }
}
