import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  DEFAULT_BEHAVIOR,
  emptyMotionSlots,
  defaultMotionSlotsFromManifest,
  newModelId,
  newMotionId,
  type CompanionBehavior,
  type CompanionConfigV2,
  type ModelEntry,
  type MotionLibraryEntry,
  type MotionSlotsConfig,
} from "../shared/companion-schema.ts";
import { mergeBehavior } from "../shared/core/behavior.ts";
import { normalizeMotionSlots } from "../shared/core/motion-slot-resolve.ts";
import { companionConfigPath, ensureCompanionDataDir } from "./paths.ts";
import { PLACEHOLDER_MODEL_PATH } from "./model-path.ts";
import { motionManifest } from "../shared/motion-manifest.ts";
import { migrateModelFiles, migrateMotionLibraryFiles } from "./asset-migration.ts";
import { loadShellClientConfig } from "@freeanima/frontend/shell-sdk/shell-client-config-node";

export type CompanionConfig = CompanionConfigV2;

const HABITAT_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");

type LegacyConfig = {
  habitat_url?: string;
  model_path?: string;
  locomotion?: Partial<Record<string, string>>;
  behavior?: Partial<CompanionBehavior>;
  active_model_id?: string;
  models?: ModelEntry[];
  motion_library?: MotionLibraryEntry[];
  motion_slots?: MotionSlotsConfig;
};

function defaultModels(): ModelEntry[] {
  return [];
}

export const DEFAULT_CONFIG: CompanionConfig = {
  habitat_url: HABITAT_URL,
  active_model_id: "",
  models: defaultModels(),
  motion_library: [],
  motion_slots: emptyMotionSlots(),
  behavior: { ...DEFAULT_BEHAVIOR },
};

function migrateLegacy(raw: LegacyConfig): CompanionConfig {
  const habitat_url = raw.habitat_url ?? DEFAULT_CONFIG.habitat_url;
  const behavior = mergeBehavior(raw.behavior);
  let models = raw.models ?? [];
  let motion_library = raw.motion_library ?? [];
  let motion_slots: MotionSlotsConfig;

  const legacyPath = raw.model_path ?? PLACEHOLDER_MODEL_PATH;
  if (models.length === 0 && legacyPath && legacyPath !== PLACEHOLDER_MODEL_PATH) {
    const id = newModelId();
    models = [
      {
        id,
        name: basename(legacyPath),
        path: legacyPath,
      },
    ];
    raw.active_model_id = id;
  }

  if (motion_library.length === 0) {
    motion_library = buildLibraryFromSlots(defaultMotionSlotsFromManifest());
  }

  if (!raw.motion_slots || Object.values(raw.motion_slots).every((arr) => arr.length === 0)) {
    motion_slots = linkSlotsToLibrary(defaultMotionSlotsFromManifest(), motion_library);
  } else {
    motion_slots = linkSlotsToLibrary(raw.motion_slots as Record<string, string[]>, motion_library);
  }

  for (const [slot, file] of Object.entries(raw.locomotion ?? {})) {
    if (file && (slot === "walk" || slot === "climb")) {
      let entry = motion_library.find((e) => e.file === file);
      if (!entry) {
        entry = { id: newMotionId(), name: file, file };
        motion_library.push(entry);
      }
      motion_slots[slot as "walk" | "climb"] = [entry.id];
    }
  }

  const active_model_id =
    raw.active_model_id && models.some((m) => m.id === raw.active_model_id)
      ? raw.active_model_id
      : (models[0]?.id ?? "");

  const merged: CompanionConfig = {
    habitat_url,
    active_model_id,
    models,
    motion_library,
    motion_slots,
    behavior,
  };

  return {
    ...merged,
    model_path: activeModelPath(merged),
  };
}

function buildLibraryFromSlots(slots: MotionSlotsConfig): MotionLibraryEntry[] {
  const files = new Set<string>();
  for (const ids of Object.values(slots)) {
    for (const id of ids) {
      if (id.endsWith(".vrma")) files.add(id);
    }
  }
  for (const file of Object.values(motionManifest.zones)) {
    files.add(file);
  }
  files.add(motionManifest.idle);
  return [...files].map((file) => ({
    id: newMotionId(),
    name: file.replace(/\.vrma$/i, ""),
    file,
  }));
}

function linkSlotsToLibrary(
  slots: Record<string, string[]>,
  library: MotionLibraryEntry[],
): MotionSlotsConfig {
  return normalizeMotionSlots(slots, library);
}

export function activeModelPath(cfg: CompanionConfig): string {
  const active = cfg.models.find((m) => m.id === cfg.active_model_id);
  return active?.path ?? cfg.model_path ?? PLACEHOLDER_MODEL_PATH;
}

export function loadConfig(): CompanionConfig {
  ensureCompanionDataDir();
  const configPath = companionConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as LegacyConfig;
    const base = migrateLegacy(raw);
    const motionResult = migrateMotionLibraryFiles(base.motion_library);
    const modelResult = migrateModelFiles(base.models);
    const next: CompanionConfig = {
      ...base,
      motion_library: motionResult.library,
      models: modelResult.models,
    };
    if (motionResult.changed || modelResult.changed) {
      writeFileSync(companionConfigPath(), JSON.stringify(next, null, 2), "utf-8");
    }
    return next;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(patch: Partial<CompanionConfig>): CompanionConfig {
  ensureCompanionDataDir();
  const prev = loadConfig();
  const next: CompanionConfig = {
    ...prev,
    ...patch,
    behavior: mergeBehavior({ ...prev.behavior, ...patch.behavior }),
    motion_slots: patch.motion_slots ?? prev.motion_slots,
    models: patch.models ?? prev.models,
    motion_library: patch.motion_library ?? prev.motion_library,
  };
  if (patch.active_model_id !== undefined) {
    next.active_model_id = patch.active_model_id;
  }
  next.model_path = activeModelPath(next);
  writeFileSync(companionConfigPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function habitatUrlFromConfig(): string {
  const fromEnv = process.env.FREEANIMA_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const shell = loadShellClientConfig();
  if (shell?.habitatUrl?.trim()) return shell.habitatUrl.trim().replace(/\/$/, "");
  const cfg = loadConfig();
  return (cfg.habitat_url ?? "").replace(/\/$/, "");
}

export function remoteAuthTokenFromShell(): string | undefined {
  const fromEnv = process.env.FREEANIMA_REMOTE_AUTH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const shell = loadShellClientConfig();
  const token = shell?.remoteAuthToken?.trim();
  return token || undefined;
}
