import { registerEmailSyncPort } from "@freeanima/features/email/domain";
import { registerNotificationPort } from "@freeanima/habitat/capabilities/tools/notification";
import { emailSyncPortImpl } from "@freeanima/habitat/capabilities/connectors/email";

import { createNotificationPort } from "./service/notification-helpers.ts";
import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import type { Config } from "@freeanima/habitat/core/config";

/** Composition root one-shot capability binding (email sync / notification) */
export function registerServiceStores(deps: FullRuntimeDeps, config: Config): void {
  registerEmailSyncPort(emailSyncPortImpl);
  registerNotificationPort(createNotificationPort(deps, config));
}
