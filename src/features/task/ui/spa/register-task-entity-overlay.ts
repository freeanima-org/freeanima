import { registerEntityOverlay } from "@freeanima/frontend/shell-ui/spa/features/entity-overlay-registry.ts";

import { TaskEntityOverlay } from "./TaskEntityOverlay.tsx";

export function registerTaskEntityOverlay(): void {
  registerEntityOverlay("task_item", TaskEntityOverlay);
}
