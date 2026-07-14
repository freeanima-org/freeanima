import { isMobileCapacitorShellCandidate } from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";
import { createWebAlertBackend } from "@freeanima/frontend/shell-sdk/alert/web-backend.ts";
import type { AlertBackend } from "@freeanima/frontend/shell-sdk/alert/types.ts";

import { createCapacitorLocalAlertBackend, isMobileShellRuntime } from "./mobile-local-alert.ts";

/** Mobile 壳：Capacitor Local Notifications；本地 SPA 同源，勿回退 Web Notification API。 */
export function createMobileAlertBackend(): AlertBackend {
  if (isMobileShellRuntime() || isMobileCapacitorShellCandidate()) {
    return createCapacitorLocalAlertBackend();
  }
  return {
    ...createWebAlertBackend(),
    platform: "mobile",
  };
}
