import { existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  companionMotionCacheFileName,
  nextCompanionSort,
  sortCompanionEntries,
} from "@freeanima/host/core/config/schemas/companion.ts";
import { deleteObjectFile } from "@freeanima/features/object-storage/domain";
import type { MotionLibraryEntry, MotionSlotId } from "./types.ts";
import { MOTION_SLOT_IDS } from "./types.ts";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
import { companionMotionsDir } from "./paths.ts";

export async function listMotionLibrary(): Promise<MotionLibraryEntry[]> {
  const cfg = await loadCompanionConfig();
  return sortCompanionEntries(cfg.motion_library);
}

export async function registerMotionEntry(entry: MotionLibraryEntry): Promise<MotionLibraryEntry> {
  const cfg = await loadCompanionConfig();
  const existing = cfg.motion_library.find((e) => e.object_file_id === entry.object_file_id);
  if (existing) return existing;
  await saveCompanionConfig({
    motion_library: [...cfg.motion_library, entry],
  });
  return entry;
}

export async function nextMotionSort(): Promise<number> {
  const cfg = await loadCompanionConfig();
  return nextCompanionSort(cfg.motion_library);
}

/** @deprecated 不再从磁盘扫入配置 */
export async function syncLibraryFromDisk(): Promise<MotionLibraryEntry[]> {
  return listMotionLibrary();
}

export async function renameMotion(
  objectFileId: number,
  name: string,
): Promise<MotionLibraryEntry> {
  const cfg = await loadCompanionConfig();
  const idx = cfg.motion_library.findIndex((e) => e.object_file_id === objectFileId);
  if (idx < 0) throw new Error("动作不存在");
  const next = [...cfg.motion_library];
  const current = next[idx];
  if (!current) throw new Error("动作不存在");
  next[idx] = { ...current, name: name.trim() || current.name };
  await saveCompanionConfig({ motion_library: next });
  const updated = next[idx];
  if (!updated) throw new Error("动作不存在");
  return updated;
}

export async function deleteMotion(objectFileId: number): Promise<void> {
  const cfg = await loadCompanionConfig();
  const entry = cfg.motion_library.find((e) => e.object_file_id === objectFileId);
  if (!entry) throw new Error("动作不存在");

  const motion_slots = { ...cfg.motion_slots };
  for (const slotId of MOTION_SLOT_IDS) {
    motion_slots[slotId] = (motion_slots[slotId] ?? []).filter((ref) => ref !== objectFileId);
  }

  const motion_library = cfg.motion_library.filter((e) => e.object_file_id !== objectFileId);
  await saveCompanionConfig({ motion_library, motion_slots });

  try {
    await deleteObjectFile(objectFileId);
  } catch {
    /* entity 可能已不存在 */
  }

  const path = join(companionMotionsDir(), companionMotionCacheFileName(objectFileId));
  if (existsSync(path) && statSync(path).isFile()) {
    unlinkSync(path);
  }
}

export async function setSlotMotions(slot: MotionSlotId, objectFileIds: number[]): Promise<void> {
  if (!MOTION_SLOT_IDS.includes(slot)) {
    throw new Error(`未知动作槽位: ${slot}`);
  }
  const cfg = await loadCompanionConfig();
  const known = new Set(cfg.motion_library.map((e) => e.object_file_id));
  for (const id of objectFileIds) {
    if (!known.has(id)) throw new Error(`动作不在库中: ${id}`);
  }
  const motion_slots = { ...cfg.motion_slots, [slot]: [...objectFileIds] };
  await saveCompanionConfig({ motion_slots });
}

export async function reorderMotions(objectFileIds: number[]): Promise<MotionLibraryEntry[]> {
  const cfg = await loadCompanionConfig();
  const byId = new Map(cfg.motion_library.map((m) => [m.object_file_id, m]));
  if (objectFileIds.length !== cfg.motion_library.length) {
    throw new Error("排序列表须包含全部动作");
  }
  const motion_library: MotionLibraryEntry[] = [];
  for (let i = 0; i < objectFileIds.length; i++) {
    const id = objectFileIds[i];
    if (id == null) throw new Error("无效 object_file_id");
    const entry = byId.get(id);
    if (!entry) throw new Error(`动作不存在: ${id}`);
    motion_library.push({ ...entry, sort: i });
    byId.delete(id);
  }
  if (byId.size > 0) throw new Error("排序列表须包含全部动作");
  await saveCompanionConfig({ motion_library });
  return sortCompanionEntries(motion_library);
}
