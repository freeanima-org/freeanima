/** @deprecated 本地 companion server CRUD 已停用；请走 Habitat domain / RPC */
import type { MotionLibraryEntry, MotionSlotId } from "../shared/companion-schema.ts";
import { loadConfig } from "./config.ts";

export function listMotionLibrary(): MotionLibraryEntry[] {
  return loadConfig().motion_library;
}

export function motionFileAvailable(_file: string): boolean {
  return false;
}

export async function registerMotionEntry(_entry: MotionLibraryEntry): Promise<MotionLibraryEntry> {
  throw new Error("请经 Habitat companion.motion.import");
}

export async function syncLibraryFromDisk(): Promise<MotionLibraryEntry[]> {
  return listMotionLibrary();
}

export function renameMotion(_objectFileId: number, _name: string): MotionLibraryEntry {
  throw new Error("请经 Habitat companion.motion.rename");
}

export function deleteMotion(_objectFileId: number): void {
  throw new Error("请经 Habitat companion.motion.delete");
}

export function setSlotMotions(_slot: MotionSlotId, _objectFileIds: number[]): void {
  throw new Error("请经 Habitat companion.motion.setSlot");
}
