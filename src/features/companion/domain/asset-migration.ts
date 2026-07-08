import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  isIdBasedModelPath,
  isIdBasedMotionFile,
  modelPathForId,
  motionFileNameForId,
} from "./asset-id.ts";
import type { ModelEntry, MotionLibraryEntry } from "./types.ts";
import { requiredMotionFiles } from "./motion-manifest.ts";
import { companionModelsDir, companionMotionsDir } from "./paths.ts";

const MANIFEST_MOTION_FILES = new Set(requiredMotionFiles());

/** 将用户导入的动作文件重命名为 {id}.vrma；官方 manifest 文件名保持不变 */
export function migrateMotionLibraryFiles(library: MotionLibraryEntry[]): {
  library: MotionLibraryEntry[];
  changed: boolean;
} {
  const dir = companionMotionsDir();
  if (!existsSync(dir)) return { library, changed: false };

  let changed = false;
  const next = library.map((entry) => {
    if (isIdBasedMotionFile(entry.id, entry.file)) return entry;
    if (MANIFEST_MOTION_FILES.has(entry.file)) return entry;

    const targetFile = motionFileNameForId(entry.id);
    const oldPath = join(dir, entry.file);
    const newPath = join(dir, targetFile);
    if (!existsSync(oldPath)) return entry;
    if (existsSync(newPath) && oldPath !== newPath) return entry;

    renameSync(oldPath, newPath);
    changed = true;
    return { ...entry, file: targetFile };
  });

  return { library: changed ? next : library, changed };
}

/** 将用户模型文件重命名为 {id}.vrm */
export function migrateModelFiles(models: ModelEntry[]): {
  models: ModelEntry[];
  changed: boolean;
} {
  const dir = companionModelsDir();
  if (!existsSync(dir)) return { models, changed: false };

  let changed = false;
  const next = models.map((entry) => {
    if (isIdBasedModelPath(entry.id, entry.path)) return entry;

    const targetPath = modelPathForId(entry.id);
    const oldName = entry.path.replace(/^\/models\//, "");
    const newName = targetPath.replace(/^\/models\//, "");
    const oldPath = join(dir, oldName);
    const newPath = join(dir, newName);
    if (!existsSync(oldPath)) return { ...entry, path: targetPath };

    if (existsSync(newPath) && oldPath !== newPath) {
      changed = true;
      return { ...entry, path: targetPath };
    }

    if (oldPath !== newPath) {
      renameSync(oldPath, newPath);
    }
    changed = true;
    return { ...entry, path: targetPath };
  });

  return { models: changed ? next : models, changed };
}
