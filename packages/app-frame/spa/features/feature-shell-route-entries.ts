import { FEATURE_SHELL_ROUTES } from "@freeanima/shared/feature-catalog";

import { FEATURE_ROUTE_LOADERS } from "./feature-route-loaders.ts";
import type { FeatureShellRouteEntry } from "./shell-registry.ts";

/** Features whose route is rendered outside the navigation-driven shell list. */
export const SHELL_ROUTE_EXCLUSIONS: ReadonlySet<string> = new Set(["habitat"]);

/** Build the shell feature routes from the shared catalog + local loaders. */
export function buildFeatureShellRouteEntries(): FeatureShellRouteEntry[] {
  const entries: FeatureShellRouteEntry[] = [];
  for (const route of FEATURE_SHELL_ROUTES) {
    if (SHELL_ROUTE_EXCLUSIONS.has(route.featureId)) continue;
    const load = FEATURE_ROUTE_LOADERS[route.featureId];
    if (!load) {
      throw new Error(`missing shell route loader for feature: ${route.featureId}`);
    }
    entries.push({
      featureId: route.featureId,
      path: route.path,
      ...(route.navLabel === undefined ? {} : { navLabel: route.navLabel }),
      load,
    });
  }
  return entries;
}
