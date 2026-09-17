import { mkdirSync } from "node:fs";
import { basename } from "node:path";
import { createObjectFile } from "@freeanima/features/object-storage/domain";
import { displayNameFromFilename } from "./asset-id.ts";
import type { MotionLibraryEntry } from "./types.ts";
import { companionMotionsDir } from "./paths.ts";
import { resolveCompanionWorldId } from "./companion-world.ts";
import { nextMotionSort, registerMotionEntry } from "./motion-library.ts";

export type MotionImportResult = {
  dir: string;
  files: string[];
  entries: MotionLibraryEntry[];
};

export function sanitizeMotionBaseName(name: string): string {
  const base = basename(name).replace(/\.[^.]+$/, "");
  return (
    base
      .replace(/[^\w.\-()+ ]+/g, "_")
      .replace(/\s+/g, "_")
      .trim() || "motion"
  );
}

async function putMotionAsObjectFile(bytes: Uint8Array, title: string): Promise<number> {
  const file = await createObjectFile({
    world_id: resolveCompanionWorldId(),
    title,
    bytes,
    mime_type: "application/octet-stream",
  });
  return file.id;
}

async function importVrmaBytes(
  bytes: Uint8Array,
  uploadName: string,
  sort: number,
): Promise<MotionLibraryEntry> {
  const name = displayNameFromFilename(uploadName);
  const object_file_id = await putMotionAsObjectFile(bytes, name);
  return registerMotionEntry({ name, object_file_id, sort });
}

/** 将单个 .vrma 导入 */
export async function importMotionUpload(
  uploadName: string,
  bytes: Uint8Array,
): Promise<MotionImportResult> {
  const destDir = companionMotionsDir();
  mkdirSync(destDir, { recursive: true });
  const lower = uploadName.toLowerCase();
  if (!lower.endsWith(".vrma")) {
    throw new Error("仅支持 .vrma");
  }

  const sort = await nextMotionSort();
  const entry = await importVrmaBytes(bytes, uploadName, sort);

  return {
    dir: destDir,
    files: [String(entry.object_file_id)],
    entries: [entry],
  };
}
