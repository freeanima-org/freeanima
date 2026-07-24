import { registerEntityOverlay } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";

import { TaskEntityOverlay } from "./TaskEntityOverlay.tsx";

export function registerTaskEntityOverlay(): void {
  registerEntityOverlay("task_item", TaskEntityOverlay);
}
