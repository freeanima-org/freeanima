import { shellLazyRoute } from "../lazy-route.tsx";
import {
  buildFeatureShellRouteEntries,
  SHELL_ROUTE_EXCLUSIONS,
} from "./feature-shell-route-entries.ts";
import { registerShellFeatureRoutes } from "./shell-registry.ts";
import { registerTaskEntityOverlay } from "@freeanima/features/task/ui/spa/register-task-entity-overlay.ts";
import { registerSemanticMemoryEntityOverlay } from "@freeanima/features/memory/ui/spa/register-semantic-memory-entity-overlay.ts";
import { registerCalendarEventEntityOverlay } from "@freeanima/features/calendar/ui/spa/register-calendar-entity-overlay.ts";
import { registerObjectFileEntityOverlay } from "@freeanima/features/entity/ui/spa/register-object-file-entity-overlay.ts";

registerTaskEntityOverlay();
registerSemanticMemoryEntityOverlay();
registerCalendarEventEntityOverlay();
registerObjectFileEntityOverlay();

export { buildFeatureShellRouteEntries, SHELL_ROUTE_EXCLUSIONS };

/** Shell routes for features (path/label from the shared catalog). */
export function registerFeaturePluginShellRoutes(): void {
  registerShellFeatureRoutes(buildFeatureShellRouteEntries());
}

/** Habitat/admin SPA embedded in shell (formerly HabitatShell). */
export function loadHabitatShellRoute() {
  return shellLazyRoute(
    () =>
      import("@freeanima/features/habitat/ui/spa").then(async (mod) => {
        await import("@freeanima/features/habitat/ui/habitat/styles.css");
        return { default: mod.HabitatShell as import("react").ComponentType<object> };
      }) as Promise<{ default: import("react").ComponentType<object> }>,
  );
}

/** 顶级「卧室」SPA：统一 Anima + 子模块（Anima 私有空间；与栖息地=实例运维成对）。 */
export function loadBedroomShellRoute() {
  return shellLazyRoute(
    () =>
      import("@freeanima/features/bedroom/ui/spa").then(async (mod) => {
        await import("@freeanima/features/habitat/ui/habitat/styles.css");
        return { default: mod.BedroomShell as import("react").ComponentType<object> };
      }) as Promise<{ default: import("react").ComponentType<object> }>,
  );
}

registerFeaturePluginShellRoutes();
