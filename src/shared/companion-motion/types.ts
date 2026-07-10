export type LocomotionSlot = "walk" | "climb";

export const MOTION_SLOT_IDS = ["idle", "rest", "walk", "climb", "in_place"] as const;
export type MotionSlotId = (typeof MOTION_SLOT_IDS)[number];

export const LEGACY_IN_PLACE_SLOT_PREFIX = "in_place_";

export type MotionLibraryEntry = {
  id: string;
  name: string;
  file: string;
  content_hash?: string;
};

export type MotionSlotsConfig = Record<MotionSlotId, string[]>;

export type LocomotionManifest = Partial<Record<LocomotionSlot, string>>;

export function emptyMotionSlots(): MotionSlotsConfig {
  const slots = {} as MotionSlotsConfig;
  for (const id of MOTION_SLOT_IDS) {
    slots[id] = [];
  }
  return slots;
}
