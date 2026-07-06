import { applyFeatureHttpRegistrations } from "./registry.ts";
import type { FeatureHttpRouteRegistrar } from "./types.ts";

/** Apply all feature HTTP registrars (console migration uses this in Phase 3). */
export function mountFeatureHttpRoutes(register: FeatureHttpRouteRegistrar): void {
  applyFeatureHttpRegistrations(register);
}
