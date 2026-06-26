import type { FridgeBridge } from "@freeanima/capabilities-task";
import { deleteMagnet, setMagnet } from "@freeanima/capabilities-tasks/fridge-magnet";

/** Composition-root factory: tasks FridgeBridge backed by Redis fridge magnets */
export function createFridgeBridge(): FridgeBridge {
  return { setMagnet, deleteMagnet };
}
