import type { ComponentType } from "react";

export type FeatureShellRouteEntry = {
  featureId: string;
  path: string;
  navLabel?: string;
  load: () => Promise<{ default: ComponentType<object> }>;
};

const routes: FeatureShellRouteEntry[] = [];

export function registerShellFeatureRoutes(entries: FeatureShellRouteEntry[]): void {
  routes.push(...entries);
}

export function listShellFeatureRoutes(): readonly FeatureShellRouteEntry[] {
  return routes;
}

export function resetShellFeatureRoutesForTests(): void {
  routes.length = 0;
}
