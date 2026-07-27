import { companionMotionCachePath } from "@freeanima/host/core/config/schemas/companion.ts";
import {
  emptyMotionSlots,
  LEGACY_IN_PLACE_SLOT_PREFIX,
  MOTION_SLOT_IDS,
  type LocomotionManifest,
  type LocomotionSlot,
  type MotionLibraryEntry,
  type MotionSlotId,
  type MotionSlotsConfig,
} from "./types.ts";

export type ResolvedMotion = {
  objectFileId: number | null;
  file: string;
};

export type { LocomotionSlot };

function cachePathFor(objectFileId: number): string {
  return companionMotionCachePath(objectFileId);
}

function libraryByObjectFileId(library: MotionLibraryEntry[]): Map<number, MotionLibraryEntry> {
  return new Map(library.map((e) => [e.object_file_id, e]));
}

function pickRandom(ids: number[]): number | null {
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)] ?? null;
}

function parseObjectFileId(ref: number | string): number | null {
  if (typeof ref === "number") {
    return Number.isInteger(ref) && ref > 0 ? ref : null;
  }
  const asNum = Number(ref);
  if (Number.isInteger(asNum) && asNum > 0) return asNum;
  const m = ref.match(/(\d+)\.vrma$/i);
  if (m?.[1]) {
    const id = Number(m[1]);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

export function resolveMotionForSlot(
  slot: MotionSlotId,
  slots: MotionSlotsConfig,
  library: MotionLibraryEntry[],
  options?: { motionId?: string | number | null },
): ResolvedMotion | null {
  const byId = libraryByObjectFileId(library);
  const slotIds = slots[slot] ?? [];

  if (options?.motionId != null && options.motionId !== "") {
    const id = parseObjectFileId(options.motionId);
    if (id == null) return null;
    const entry = byId.get(id);
    if (!entry) return null;
    return { objectFileId: entry.object_file_id, file: cachePathFor(entry.object_file_id) };
  }

  const randomId = pickRandom(slotIds);
  if (randomId != null) {
    const entry = byId.get(randomId);
    if (entry) {
      return { objectFileId: entry.object_file_id, file: cachePathFor(entry.object_file_id) };
    }
    return { objectFileId: randomId, file: cachePathFor(randomId) };
  }

  return null;
}

export function resolveLocomotionMotion(
  slot: LocomotionSlot,
  slots: MotionSlotsConfig,
  library: MotionLibraryEntry[],
  locomotionManifest?: LocomotionManifest,
): ResolvedMotion | null {
  const fromSlot = resolveMotionForSlot(slot, slots, library);
  if (fromSlot?.file) return fromSlot;

  const fallbackFile = locomotionManifest?.[slot];
  if (!fallbackFile) return null;

  // manifest 文件名仅作本地/dev 回退；无对应 object_file 时仍返回路径供本地包加载
  return { objectFileId: null, file: fallbackFile };
}

/** 将原始槽位表规范为 object_file_id[]（忽略无法解析的引用） */
export function normalizeMotionSlots(
  raw: Record<string, Array<string | number>>,
  library: MotionLibraryEntry[],
  _locomotionManifest?: LocomotionManifest,
): MotionSlotsConfig {
  const next = emptyMotionSlots();
  const inPlace = new Set<number>();
  const known = new Set(library.map((e) => e.object_file_id));

  const mapRefs = (refs: Array<string | number>): number[] => {
    const out: number[] = [];
    for (const ref of refs) {
      const id = parseObjectFileId(ref);
      if (id != null && (known.size === 0 || known.has(id))) out.push(id);
    }
    return out;
  };

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

  return next;
}
