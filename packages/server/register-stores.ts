import { registerEmailSyncPort } from "@freeanima/features/email/domain";
import { mountNotificationService } from "@freeanima/capabilities/tools/notification";
import { emailSyncPortImpl } from "@freeanima/features/email/habitat/connectors";

import { createNotificationPort } from "./service/notification-helpers.ts";
import type { FullRuntimeDeps } from "@freeanima/capabilities/ports/runtime-deps.ts";
import type { Config } from "@freeanima/core/config";

/** Composition root one-shot capability binding (email sync / notification) */
export function registerServiceStores(deps: FullRuntimeDeps, config: Config): void {
  registerEmailSyncPort(emailSyncPortImpl);
  const port = createNotificationPort(deps, config);
  mountNotificationService(deps.kernel.ctx, port);
}
