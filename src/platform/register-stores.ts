import { registerEmailSyncPort } from "@freeanima/feature-email/domain";
import { registerNotificationPort } from "@freeanima/capabilities-tools/notification";
import { emailSyncPortImpl } from "@freeanima/platform/connectors/email";

import { createNotificationPort } from "./runtime/notification-helpers.ts";
import type { FullRuntimeDeps } from "./runtime/runtime-deps.ts";
import type { Config } from "@freeanima/core/config";

/** Composition root one-shot capability wiring (email sync / notification) */
export function registerServiceStores(deps: FullRuntimeDeps, config: Config): void {
  registerEmailSyncPort(emailSyncPortImpl);
  registerNotificationPort(createNotificationPort(deps, config));
}
