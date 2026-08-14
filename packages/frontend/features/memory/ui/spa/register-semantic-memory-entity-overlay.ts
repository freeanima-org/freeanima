import { registerEntityOverlay } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";

import { SemanticMemoryEntityOverlay } from "./SemanticMemoryEntityOverlay.tsx";

export function registerSemanticMemoryEntityOverlay(): void {
  registerEntityOverlay("semantic_memory", SemanticMemoryEntityOverlay);
}
