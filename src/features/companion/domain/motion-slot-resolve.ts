import type { MotionLibraryEntry, MotionSlotId, MotionSlotsConfig } from "./types.ts";
import {
  LEGACY_IN_PLACE_SLOT_PREFIX,
  MOTION_SLOT_IDS,
  emptyMotionSlots,
  type LocomotionSlot,
} from "./types.ts";
import { motionManifest } from "./motion-manifest.ts";

export type ResolvedMotion = {
  motionId: string | null;
  file: string;
};

export type { LocomotionSlot };

function libraryById(library: MotionLibraryEntry[]): Map<string, MotionLibraryEntry> {
  return new Map(library.map((e) => [e.id, e]));
}

function libraryByFile(library: MotionLibraryEntry[]): Map<string, MotionLibraryEntry> {
  return new Map(library.map((e) => [e.file, e]));
}

function pickRandom(ids: string[]): string | null {
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)] ?? null;
}

function resolveLibraryRef(ref: string, library: MotionLibraryEntry[]): string {
  if (!ref.endsWith(".vrma")) return ref;
  const byFile = libraryByFile(library);
  const mapped = byFile.get(ref);
  if (mapped) return mapped.id;
  const stem = ref.replace(/\.vrma$/i, "");
  const byStem = library.find((e) => e.name === stem || e.file === ref);
  return byStem?.id ?? ref;
}

export function resolveMotionForSlot(
  slot: MotionSlotId,
  slots: MotionSlotsConfig,
  library: MotionLibraryEntry[],
  options?: { motionId?: string | null },
): ResolvedMotion | null {
  const byId = libraryById(library);
  const byFile = libraryByFile(library);
  const slotIds = slots[slot] ?? [];

  if (options?.motionId) {
    const entry = byId.get(options.motionId);
    if (entry) {
      return { motionId: entry.id, file: entry.file };
    }
  }

  const randomId = pickRandom(slotIds);
  if (randomId) {
    const asEntry = byId.get(randomId);
    if (asEntry) {
      return { motionId: asEntry.id, file: asEntry.file };
    }
    if (randomId.endsWith(".vrma")) {
      const mapped = byFile.get(randomId);
      if (mapped) {
        return { motionId: mapped.id, file: mapped.file };
      }
      const stem = randomId.replace(/\.vrma$/i, "");
      const byStem = library.find((e) => e.name === stem);
      if (byStem) {
        return { motionId: byStem.id, file: byStem.file };
      }
      return { motionId: null, file: randomId };
    }
  }

  return null;
}

export function resolveLocomotionMotion(
  slot: LocomotionSlot,
  slots: MotionSlotsConfig,
  library: MotionLibraryEntry[],
): ResolvedMotion | null {
  const fromSlot = resolveMotionForSlot(slot, slots, library);
  if (fromSlot?.file) return fromSlot;

  const fallbackFile = motionManifest.locomotion?.[slot];
  if (!fallbackFile) return null;

  const entry = library.find((e) => e.file === fallbackFile);
  if (entry) {
    return { motionId: entry.id, file: entry.file };
  }
  const stem = fallbackFile.replace(/\.vrma$/i, "");
  const byStem = library.find((e) => e.name === stem);
  if (byStem) {
    return { motionId: byStem.id, file: byStem.file };
  }
  return { motionId: null, file: fallbackFile };
}

export function normalizeMotionSlots(
  raw: Record<string, string[]>,
  library: MotionLibraryEntry[],
): MotionSlotsConfig {
  const next = emptyMotionSlots();
  const inPlace = new Set<string>();

  const mapRefs = (refs: string[]): string[] =>
    refs.map((ref) => resolveLibraryRef(ref, library)).filter((ref) => ref.length > 0);

  for (const [key, refs] of Object.entries(raw)) {
    if (key === "in_place") {
      for (const id of mapRefs(refs)) inPlace.add(id);
      continue;
    }
    if (key.startsWith(LEGACY_IN_PLACE_SLOT_PREFIX)) {
      for (const id of mapRefs(refs)) inPlace.add(id);
      continue;
    }
    if (MOTION_SLOT_IDS.includes(key as MotionSlotId)) {
      next[key as MotionSlotId] = mapRefs(refs);
    }
  }

  next.in_place = [...inPlace];

  for (const slot of ["walk", "climb"] as const) {
    if (next[slot].length > 0) continue;
    const manifestFile = motionManifest.locomotion?.[slot];
    if (!manifestFile) continue;
    const id = resolveLibraryRef(manifestFile, library);
    if (!id.endsWith(".vrma")) {
      next[slot] = [id];
    }
  }

  return next;
}
