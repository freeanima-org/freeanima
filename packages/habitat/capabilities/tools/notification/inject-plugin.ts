import type { Context } from "cordis";
import { onBeforeLlmCall } from "@freeanima/habitat/core/hooks/cordis";
import { createNotificationInjectHandler } from "./handler.ts";

/**
 * Registers the notification `beforeLlmCall` injector.
 *
 * Uses `ctx.inject(['notifications'])` so activation is ordered by the service
 * dependency: mounting this plugin before `NotificationService` is safe and the
 * hook only starts once the service is provided.
 */
export function notificationInjectPlugin(ctx: Context): void {
  ctx.inject(["notifications"], (scope) => {
    onBeforeLlmCall(scope, createNotificationInjectHandler(scope.notifications.port));
  });
}
