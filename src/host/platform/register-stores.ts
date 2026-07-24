import { registerEmailSyncPort } from "@freeanima/features/email/domain";
import { registerNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import { emailSyncPortImpl } from "@freeanima/host/capabilities/connectors/email";

import { createNotificationPort } from "./service/notification-helpers.ts";
import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import type { Config } from "@freeanima/host/core/config";

/** Composition root one-shot capability binding (email sync / notification) */
export function registerServiceStores(deps: FullRuntimeDeps, config: Config): void {
  registerEmailSyncPort(emailSyncPortImpl);
  registerNotificationPort(createNotificationPort(deps, config));
}
