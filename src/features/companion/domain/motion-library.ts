import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { displayNameFromFilename, motionFileNameForId, newMotionId } from "./asset-id.ts";
import {
  type MotionLibraryEntry,
  type MotionSlotId,
  MOTION_SLOT_IDS,
  defaultMotionSlotsFromManifest,
} from "./types.ts";
import { requiredMotionFiles } from "./motion-manifest.ts";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
import { companionMotionsDir } from "./paths.ts";
import { resolveMotionFile } from "./motions.ts";

const MANIFEST_MOTION_FILES = new Set(requiredMotionFiles());

export async function listMotionLibrary(): Promise<MotionLibraryEntry[]> {
  const cfg = await loadCompanionConfig();
  return cfg.motion_library;
}

export function motionFileAvailable(file: string): boolean {
  return resolveMotionFile(`/motions/${file}`) != null;
}

async function registerMotionEntry(entry: MotionLibraryEntry): Promise<MotionLibraryEntry> {
  const cfg = await loadCompanionConfig();
  const existing = cfg.motion_library.find((e) => e.id === entry.id);
  if (existing) return existing;
  await saveCompanionConfig({ motion_library: [...cfg.motion_library, entry] });
  return entry;
}

async function addMotionToLibrary(file: string, name?: string): Promise<MotionLibraryEntry> {
  const cfg = await loadCompanionConfig();
  const existing = cfg.motion_library.find((e) => e.file === file);
  if (existing) return existing;
  const id = newMotionId();
  const entry: MotionLibraryEntry = {
    id,
    name: name ?? displayNameFromFilename(file),
    file,
  };
  return registerMotionEntry(entry);
}

export async function syncLibraryFromDisk(): Promise<MotionLibraryEntry[]> {
  const dir = companionMotionsDir();
  if (!existsSync(dir)) return listMotionLibrary();

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".vrma"));
  const cfg = await loadCompanionConfig();
  const known = new Set(cfg.motion_library.map((e) => e.file));
  const added: MotionLibraryEntry[] = [];

  for (const file of files) {
    if (known.has(file)) continue;
    if (MANIFEST_MOTION_FILES.has(file)) {
      added.push(await addMotionToLibrary(file));
      continue;
    }

    const id = newMotionId();
    const targetFile = motionFileNameForId(id);
    const oldPath = join(dir, file);
    const newPath = join(dir, targetFile);
    if (oldPath !== newPath) {
      renameSync(oldPath, newPath);
    }
    added.push(
      await registerMotionEntry({
        id,
        name: displayNameFromFilename(file),
        file: targetFile,
      }),
    );
  }

  if (added.length > 0) {
    const library = await listMotionLibrary();
    await linkSlotsFromManifest(library);
    return listMotionLibrary();
  }
  return cfg.motion_library;
}

async function linkSlotsFromManifest(library: MotionLibraryEntry[]): Promise<void> {
  const byFile = new Map(library.map((e) => [e.file, e.id]));
  const template = defaultMotionSlotsFromManifest();
  const cfg = await loadCompanionConfig();
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
  if (changed) await saveCompanionConfig({ motion_slots });
}

export async function renameMotion(id: string, name: string): Promise<MotionLibraryEntry> {
  const cfg = await loadCompanionConfig();
  const idx = cfg.motion_library.findIndex((e) => e.id === id);
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

export async function deleteMotion(id: string): Promise<void> {
  const cfg = await loadCompanionConfig();
  const entry = cfg.motion_library.find((e) => e.id === id);
  if (!entry) throw new Error("动作不存在");

  const motion_slots = { ...cfg.motion_slots };
  for (const slotId of MOTION_SLOT_IDS) {
    motion_slots[slotId] = (motion_slots[slotId] ?? []).filter((ref) => ref !== id);
  }

  const motion_library = cfg.motion_library.filter((e) => e.id !== id);
  await saveCompanionConfig({ motion_library, motion_slots });

  const path = join(companionMotionsDir(), entry.file);
  if (existsSync(path) && statSync(path).isFile()) {
    unlinkSync(path);
  }
}

export async function setSlotMotions(slot: MotionSlotId, motionIds: string[]): Promise<void> {
  if (!MOTION_SLOT_IDS.includes(slot)) {
    throw new Error(`未知动作槽位: ${slot}`);
  }
  const cfg = await loadCompanionConfig();
  const motion_slots = { ...cfg.motion_slots, [slot]: [...motionIds] };
  await saveCompanionConfig({ motion_slots });
}
