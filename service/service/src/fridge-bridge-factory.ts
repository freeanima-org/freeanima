import { deleteMagnet, setMagnet } from "@freeanima/capabilities-fridge-magnet";
import type { FridgeBridge } from "@freeanima/capabilities-tasks";

/** Composition-root factory: tasks FridgeBridge backed by Redis fridge magnets */
export function createFridgeBridge(): FridgeBridge {
  return { setMagnet, deleteMagnet };
}
