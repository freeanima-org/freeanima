import type {
  ModelEntry,
  MotionLibraryEntry,
} from "@freeanima/shared/companion-app/companion-schema.ts";

/** 旧磁盘文件名迁移已废弃 */
export function migrateMotionLibraryFiles(library: MotionLibraryEntry[]): {
  library: MotionLibraryEntry[];
  renamed: number;
} {
  return { library, renamed: 0 };
}

export function migrateModelFiles(models: ModelEntry[]): {
  models: ModelEntry[];
  renamed: number;
} {
  return { models, renamed: 0 };
}
