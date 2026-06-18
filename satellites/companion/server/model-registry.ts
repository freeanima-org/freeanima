import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { newModelId, type ModelEntry } from "../shared/companion-schema.ts";
import { loadConfig, saveConfig, activeModelPath } from "./config.ts";
import { companionModelsDir, ensureCompanionDataDir } from "./paths.ts";
import { isModelPathAvailable } from "./model-path.ts";
import { sanitizeModelFilename, validateVrmUpload } from "./models.ts";

export function listModels(): ModelEntry[] {
  return loadConfig().models;
}

export function activeModel(): ModelEntry | null {
  const cfg = loadConfig();
  return cfg.models.find((m) => m.id === cfg.active_model_id) ?? null;
}

export async function addModelFromUpload(file: File): Promise<ModelEntry> {
  const validationError = validateVrmUpload(file);
  if (validationError) throw new Error(validationError);

  ensureCompanionDataDir();
  const filename = sanitizeModelFilename(file.name);
  const dest = join(companionModelsDir(), filename);
  return addModelFromBytes(file.name, filename, dest, file);
}

async function addModelFromBytes(
  displayName: string,
  filename: string,
  dest: string,
  file: File,
): Promise<ModelEntry> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  await Bun.write(dest, bytes);
  const path = `/models/${filename}`;
  const cfg = loadConfig();
  const existing = cfg.models.find((m) => m.path === path);
  if (existing) {
    saveConfig({ active_model_id: existing.id, model_path: path });
    return existing;
  }

  const entry: ModelEntry = {
    id: newModelId(),
    name: displayName.replace(/\.vrm$/i, ""),
    path,
  };
  const models = [...cfg.models, entry];
  saveConfig({ models, active_model_id: entry.id, model_path: path });
  return entry;
}

export function setActiveModel(id: string): ModelEntry {
  const cfg = loadConfig();
  const model = cfg.models.find((m) => m.id === id);
  if (!model) throw new Error("模型不存在");
  saveConfig({ active_model_id: id, model_path: model.path });
  return model;
}

export function renameModel(id: string, name: string): ModelEntry {
  const cfg = loadConfig();
  const idx = cfg.models.findIndex((m) => m.id === id);
  if (idx < 0) throw new Error("模型不存在");
  const models = [...cfg.models];
  models[idx] = { ...models[idx]!, name: name.trim() || models[idx]!.name };
  saveConfig({ models });
  return models[idx]!;
}

export function deleteModel(id: string): void {
  const cfg = loadConfig();
  const model = cfg.models.find((m) => m.id === id);
  if (!model) throw new Error("模型不存在");

  const models = cfg.models.filter((m) => m.id !== id);
  let active_model_id = cfg.active_model_id;
  if (active_model_id === id) {
    active_model_id = models[0]?.id ?? "";
  }

  saveConfig({
    models,
    active_model_id,
    model_path: activeModelPath({ ...cfg, models, active_model_id }),
  });

  const filename = model.path.replace(/^\/models\//, "");
  const path = join(companionModelsDir(), filename);
  if (existsSync(path) && statSync(path).isFile()) {
    unlinkSync(path);
  }
}

export function scanModelsOnDisk(): ModelEntry[] {
  const dir = companionModelsDir();
  if (!existsSync(dir)) return listModels();

  const cfg = loadConfig();
  const known = new Set(cfg.models.map((m) => m.path));
  const models = [...cfg.models];

  for (const file of readdirSync(dir)) {
    if (!file.toLowerCase().endsWith(".vrm")) continue;
    const path = `/models/${file}`;
    if (!known.has(path)) {
      models.push({
        id: newModelId(),
        name: file.replace(/\.vrm$/i, ""),
        path,
      });
    }
  }
  if (models.length !== cfg.models.length) {
    const active_model_id = cfg.active_model_id || models[0]?.id || "";
    saveConfig({
      models,
      active_model_id,
      model_path: activeModelPath({ ...cfg, models, active_model_id }),
    });
  }
  return loadConfig().models;
}

export function modelAvailable(path: string): boolean {
  return isModelPathAvailable(path);
}
