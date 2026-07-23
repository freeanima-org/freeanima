import {
  normalizeMotionSlots as normalizeMotionSlotsBase,
  resolveLocomotionMotion as resolveLocomotionMotionBase,
  resolveMotionForSlot,
  type LocomotionSlot,
  type ResolvedMotion,
} from "@freeanima/shared/companion-motion";
import type {
  MotionLibraryEntry,
  MotionSlotsConfig,
} from "@freeanima/shared/companion-motion/types.ts";

import { motionManifest } from "../motion-manifest.ts";

export type { LocomotionSlot, ResolvedMotion };
export { resolveMotionForSlot };

export function resolveLocomotionMotion(
  slot: LocomotionSlot,
  slots: MotionSlotsConfig,
  library: MotionLibraryEntry[],
): ResolvedMotion | null {
  return resolveLocomotionMotionBase(slot, slots, library, motionManifest.locomotion);
}

export function normalizeMotionSlots(
  raw: Record<string, string[]>,
  library: MotionLibraryEntry[],
): MotionSlotsConfig {
  return normalizeMotionSlotsBase(raw, library, motionManifest.locomotion);
}
