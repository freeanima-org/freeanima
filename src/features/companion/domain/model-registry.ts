import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  displayNameFromFilename,
  modelFileNameForId,
  modelPathForId,
  newModelId,
} from "./asset-id.ts";
import type { ModelEntry } from "./types.ts";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
import { hashBytes } from "./asset-hash.ts";
import { companionModelsDir, ensureCompanionDataDir } from "./paths.ts";
import { isModelPathAvailable } from "./model-path.ts";
import { validateVrmUpload } from "./models.ts";
import { writeBytes } from "./process-utils.ts";

export async function listModels(): Promise<ModelEntry[]> {
  const cfg = await loadCompanionConfig();
  return cfg.models;
}

export async function addModelFromUpload(file: File): Promise<ModelEntry> {
  const validationError = validateVrmUpload(file);
  if (validationError) throw new Error(validationError);

  ensureCompanionDataDir();
  const id = newModelId();
  const filename = modelFileNameForId(id);
  const dest = join(companionModelsDir(), filename);
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeBytes(dest, bytes);
  const content_hash = hashBytes(bytes);

  const path = modelPathForId(id);
  const cfg = await loadCompanionConfig();
  const entry: ModelEntry = {
    id,
    name: displayNameFromFilename(file.name),
    path,
    content_hash,
  };
  const models = [...cfg.models, entry];
  await saveCompanionConfig({ models, active_model_id: entry.id });
  return entry;
}

export async function setActiveModel(id: string): Promise<ModelEntry> {
  const cfg = await loadCompanionConfig();
  const model = cfg.models.find((m) => m.id === id);
  if (!model) throw new Error("模型不存在");
  await saveCompanionConfig({ active_model_id: id });
  return model;
}

export async function renameModel(id: string, name: string): Promise<ModelEntry> {
  const cfg = await loadCompanionConfig();
  const idx = cfg.models.findIndex((m) => m.id === id);
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

export async function deleteModel(id: string): Promise<void> {
  const cfg = await loadCompanionConfig();
  const model = cfg.models.find((m) => m.id === id);
  if (!model) throw new Error("模型不存在");

  const models = cfg.models.filter((m) => m.id !== id);
  let active_model_id = cfg.active_model_id;
  if (active_model_id === id) {
    active_model_id = models[0]?.id ?? "";
  }

  await saveCompanionConfig({ models, active_model_id });

  const filename = model.path.replace(/^\/models\//, "");
  const path = join(companionModelsDir(), filename);
  if (existsSync(path) && statSync(path).isFile()) {
    unlinkSync(path);
  }
}

export async function scanModelsOnDisk(): Promise<ModelEntry[]> {
  const dir = companionModelsDir();
  if (!existsSync(dir)) return listModels();

  const cfg = await loadCompanionConfig();
  const knownPaths = new Set(cfg.models.map((m) => m.path));
  const models = [...cfg.models];
  let changed = false;

  for (const file of readdirSync(dir)) {
    if (!file.toLowerCase().endsWith(".vrm")) continue;
    const path = `/models/${file}`;
    if (knownPaths.has(path)) continue;

    const id = newModelId();
    const targetFile = modelFileNameForId(id);
    const oldPath = join(dir, file);
    const newPath = join(dir, targetFile);
    if (oldPath !== newPath) {
      renameSync(oldPath, newPath);
    }
    models.push({
      id,
      name: displayNameFromFilename(file),
      path: modelPathForId(id),
    });
    changed = true;
  }

  if (changed) {
    const active_model_id = cfg.active_model_id || models[0]?.id || "";
    await saveCompanionConfig({ models, active_model_id });
  }
  return listModels();
}

export function modelAvailable(path: string): boolean {
  return isModelPathAvailable(path);
}
