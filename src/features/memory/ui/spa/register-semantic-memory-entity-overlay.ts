import { registerEntityOverlay } from "@freeanima/frontend/app-ui/spa/features/entity-overlay-registry.ts";

import { SemanticMemoryEntityOverlay } from "./SemanticMemoryEntityOverlay.tsx";

export function registerSemanticMemoryEntityOverlay(): void {
  registerEntityOverlay("semantic_memory", SemanticMemoryEntityOverlay);
}
