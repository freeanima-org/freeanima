import { registerEntityOverlay } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";
import { OBJECT_FILE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";

import { ObjectFileEntityOverlay } from "./ObjectFileEntityOverlay.tsx";

export function registerObjectFileEntityOverlay(): void {
  registerEntityOverlay(OBJECT_FILE_COMPONENT, ObjectFileEntityOverlay);
}
