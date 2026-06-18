import type { MotionLibraryEntry, MotionSlotId, MotionSlotsConfig } from "../companion-schema.ts";
import {
  LEGACY_IN_PLACE_SLOT_PREFIX,
  MOTION_SLOT_IDS,
  emptyMotionSlots,
} from "../companion-schema.ts";

export type ResolvedMotion = {
  motionId: string | null;
  file: string;
};

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

/**
 * 解析动作槽位播放目标：指定 id → 槽位内随机；槽位为空则返回 null（无程序化回退）
 */
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
      return { motionId: byFile.get(randomId)?.id ?? null, file: randomId };
    }
  }

  return null;
}

/** 将旧版 in_place_* 槽位合并为单个 in_place */
export function normalizeMotionSlots(
  raw: Record<string, string[]>,
  library: MotionLibraryEntry[],
): MotionSlotsConfig {
  const byFile = new Map(library.map((e) => [e.file, e.id]));
  const next = emptyMotionSlots();
  const inPlace = new Set<string>();

  const mapRefs = (refs: string[]): string[] =>
    refs
      .map((ref) => {
        if (ref.endsWith(".vrma")) return byFile.get(ref) ?? ref;
        return ref;
      })
      .filter((ref) => ref.length > 0);

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
