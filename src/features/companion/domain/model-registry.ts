import { existsSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  companionModelCacheFileName,
  nextCompanionSort,
  sortCompanionEntries,
} from "@freeanima/host/core/config/schemas/companion.ts";
import { createObjectFile, deleteObjectFile } from "@freeanima/features/object-storage/domain";
import { displayNameFromFilename } from "./asset-id.ts";
import type { ModelEntry } from "./types.ts";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
import { companionModelsDir, ensureCompanionDataDir } from "./paths.ts";
import { validateVrmUpload } from "./models.ts";
import { resolveCompanionWorldId } from "./companion-world.ts";

export async function listModels(): Promise<ModelEntry[]> {
  const cfg = await loadCompanionConfig();
  return sortCompanionEntries(cfg.models);
}

export async function addModelFromUpload(file: File): Promise<ModelEntry> {
  const validationError = validateVrmUpload(file);
  if (validationError) throw new Error(validationError);

  ensureCompanionDataDir();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const objectFile = await createObjectFile({
    world_id: resolveCompanionWorldId(),
    title: displayNameFromFilename(file.name),
    bytes,
    mime_type: "model/vrm",
  });

  const cfg = await loadCompanionConfig();
  const entry: ModelEntry = {
    name: displayNameFromFilename(file.name),
    object_file_id: objectFile.id,
    sort: nextCompanionSort(cfg.models),
  };
  const models = [...cfg.models, entry];
  await saveCompanionConfig({
    models,
    active_object_file_id: entry.object_file_id,
  });
  return entry;
}

export async function setActiveModel(objectFileId: number): Promise<ModelEntry> {
  const cfg = await loadCompanionConfig();
  const model = cfg.models.find((m) => m.object_file_id === objectFileId);
  if (!model) throw new Error("模型不存在");
  await saveCompanionConfig({ active_object_file_id: objectFileId });
  return model;
}

export async function renameModel(objectFileId: number, name: string): Promise<ModelEntry> {
  const cfg = await loadCompanionConfig();
  const idx = cfg.models.findIndex((m) => m.object_file_id === objectFileId);
  if (idx < 0) throw new Error("模型不存在");
  const models = [...cfg.models];
  const current = models[idx];
  if (!current) throw new Error("模型不存在");
  models[idx] = { ...current, name: name.trim() || current.name };
  await saveCompanionConfig({ models });
  const updated = models[idx];
  if (!updated) throw new Error("模型不存在");
  return updated;
}

export async function deleteModel(objectFileId: number): Promise<void> {
  const cfg = await loadCompanionConfig();
  const model = cfg.models.find((m) => m.object_file_id === objectFileId);
  if (!model) throw new Error("模型不存在");

  const models = cfg.models.filter((m) => m.object_file_id !== objectFileId);
  let active_object_file_id = cfg.active_object_file_id;
  if (active_object_file_id === objectFileId) {
    active_object_file_id = models[0]?.object_file_id ?? null;
  }

  await saveCompanionConfig({ models, active_object_file_id });

  try {
    await deleteObjectFile(objectFileId);
  } catch {
    /* entity 可能已不存在 */
  }

  const path = join(companionModelsDir(), companionModelCacheFileName(objectFileId));
  if (existsSync(path) && statSync(path).isFile()) {
    unlinkSync(path);
  }
}

/** 按给定 object_file_id 顺序重排 sort（0..n-1） */
export async function reorderModels(objectFileIds: number[]): Promise<ModelEntry[]> {
  const cfg = await loadCompanionConfig();
  const byId = new Map(cfg.models.map((m) => [m.object_file_id, m]));
  if (objectFileIds.length !== cfg.models.length) {
    throw new Error("排序列表须包含全部模型");
  }
  const models: ModelEntry[] = [];
  for (let i = 0; i < objectFileIds.length; i++) {
    const id = objectFileIds[i];
    if (id == null) throw new Error("无效 object_file_id");
    const entry = byId.get(id);
    if (!entry) throw new Error(`模型不存在: ${id}`);
    models.push({ ...entry, sort: i });
    byId.delete(id);
  }
  if (byId.size > 0) throw new Error("排序列表须包含全部模型");
  await saveCompanionConfig({ models });
  return sortCompanionEntries(models);
}

/** @deprecated 不再从磁盘扫入配置；配置仅含已上传 object_file */
export async function scanModelsOnDisk(): Promise<ModelEntry[]> {
  return listModels();
}
