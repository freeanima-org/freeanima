/** @deprecated 本地 companion server CRUD 已停用；请走 Habitat domain / RPC */
import type { ModelEntry } from "@freeanima/shared/companion-app/companion-schema.ts";
import { companionModelCachePath } from "@freeanima/shared/companion-app/companion-schema.ts";
import { loadConfig } from "./config.ts";

export function listModels(): ModelEntry[] {
  return loadConfig().models;
}

export function getActiveModel(): ModelEntry | null {
  const cfg = loadConfig();
  if (cfg.active_object_file_id == null) return null;
  return cfg.models.find((m) => m.object_file_id === cfg.active_object_file_id) ?? null;
}

export function activeModelPath(): string {
  const id = loadConfig().active_object_file_id;
  return id == null ? "" : companionModelCachePath(id);
}

export async function addModelFromUpload(_file: File): Promise<ModelEntry> {
  throw new Error("请经 Habitat companion.model.upload 导入模型");
}

export function setActiveModel(_objectFileId: number): ModelEntry {
  throw new Error("请经 Habitat companion.model.setActive");
}

export function renameModel(_objectFileId: number, _name: string): ModelEntry {
  throw new Error("请经 Habitat companion.model.rename");
}

export function deleteModel(_objectFileId: number): void {
  throw new Error("请经 Habitat companion.model.delete");
}

export function scanModelsOnDisk(): ModelEntry[] {
  return listModels();
}
