import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  newMotionId,
  type MotionLibraryEntry,
  type MotionSlotId,
  MOTION_SLOT_IDS,
  defaultMotionSlotsFromManifest,
} from "../shared/companion-schema.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { companionMotionsDir } from "./paths.ts";
import { resolveMotionFile } from "./motions.ts";

export function listMotionLibrary(): MotionLibraryEntry[] {
  return loadConfig().motion_library;
}

export function motionLibraryEntry(id: string): MotionLibraryEntry | undefined {
  return loadConfig().motion_library.find((e) => e.id === id);
}

export function motionFileAvailable(file: string): boolean {
  return resolveMotionFile(`/motions/${file}`) !== null;
}

export function addMotionToLibrary(file: string, name?: string): MotionLibraryEntry {
  const cfg = loadConfig();
  const existing = cfg.motion_library.find((e) => e.file === file);
  if (existing) return existing;

  const entry: MotionLibraryEntry = {
    id: newMotionId(),
    name: name ?? file.replace(/\.vrma$/i, ""),
    file,
  };
  saveConfig({ motion_library: [...cfg.motion_library, entry] });
  return entry;
}

export function syncLibraryFromDisk(): MotionLibraryEntry[] {
  const dir = companionMotionsDir();
  if (!existsSync(dir)) return listMotionLibrary();

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".vrma"));
  const cfg = loadConfig();
  const known = new Set(cfg.motion_library.map((e) => e.file));
  const added: MotionLibraryEntry[] = [];

  for (const file of files) {
    if (!known.has(file)) {
      added.push(addMotionToLibrary(file));
    }
  }
  const library = loadConfig().motion_library;
  if (added.length > 0) {
    linkSlotsFromManifest(library);
    return loadConfig().motion_library;
  }
  return library;
}

function linkSlotsFromManifest(library: MotionLibraryEntry[]): void {
  const byFile = new Map(library.map((e) => [e.file, e.id]));
  const template = defaultMotionSlotsFromManifest();
  const cfg = loadConfig();
  const motion_slots = { ...cfg.motion_slots };
  let changed = false;
  for (const slotId of MOTION_SLOT_IDS) {
    if ((motion_slots[slotId]?.length ?? 0) > 0) continue;
    const refs = template[slotId] ?? [];
    const ids = refs.map((file) => byFile.get(file)).filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      motion_slots[slotId] = ids;
      changed = true;
    }
  }
  if (changed) saveConfig({ motion_slots });
}

export function renameMotion(id: string, name: string): MotionLibraryEntry {
  const cfg = loadConfig();
  const idx = cfg.motion_library.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error("动作不存在");
  const next = [...cfg.motion_library];
  next[idx] = { ...next[idx]!, name: name.trim() || next[idx]!.name };
  saveConfig({ motion_library: next });
  return next[idx]!;
}

export function deleteMotion(id: string): void {
  const cfg = loadConfig();
  const entry = cfg.motion_library.find((e) => e.id === id);
  if (!entry) throw new Error("动作不存在");

  const motion_slots = { ...cfg.motion_slots };
  for (const slotId of MOTION_SLOT_IDS) {
    motion_slots[slotId] = (motion_slots[slotId] ?? []).filter((ref) => ref !== id);
  }

  const motion_library = cfg.motion_library.filter((e) => e.id !== id);
  saveConfig({ motion_library, motion_slots });

  const path = join(companionMotionsDir(), entry.file);
  if (existsSync(path) && statSync(path).isFile()) {
    unlinkSync(path);
  }
}

export function setSlotMotions(slot: MotionSlotId, motionIds: string[]): void {
  if (!MOTION_SLOT_IDS.includes(slot)) {
    throw new Error(`未知动作槽位: ${slot}`);
  }
  const cfg = loadConfig();
  const motion_slots = { ...cfg.motion_slots, [slot]: [...motionIds] };
  saveConfig({ motion_slots });
}

export function clientMotionSlots(): Record<MotionSlotId, string[]> {
  return loadConfig().motion_slots;
}
