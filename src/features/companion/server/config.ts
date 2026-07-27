import { companionConfigPath, ensureCompanionDataDir } from "./paths.ts";
import {
  DEFAULT_BEHAVIOR,
  emptyMotionSlots,
  type CompanionBehavior,
  type CompanionConfigV2,
} from "../shared/companion-schema.ts";
import { companionConfigSchema } from "@freeanima/host/core/config/schemas/companion.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadShellClientConfig } from "@freeanima/client/portal-sdk/shell-client-config-node";

export type CompanionConfig = CompanionConfigV2;

const HABITAT_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");

export const DEFAULT_CONFIG: CompanionConfig = {
  habitat_url: HABITAT_URL,
  active_object_file_id: null,
  models: [],
  motion_library: [],
  motion_slots: emptyMotionSlots(),
  behavior: { ...DEFAULT_BEHAVIOR },
};

function coerceLocal(raw: unknown): CompanionConfig {
  const parsed = companionConfigSchema.safeParse(raw);
  if (parsed.success) {
    const habitat_url =
      raw && typeof raw === "object" && "habitat_url" in raw
        ? String((raw as { habitat_url?: string }).habitat_url ?? HABITAT_URL)
        : HABITAT_URL;
    return { ...parsed.data, habitat_url };
  }
  return { ...DEFAULT_CONFIG };
}

export function loadConfig(): CompanionConfig {
  ensureCompanionDataDir();
  const path = companionConfigPath();
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  try {
    return coerceLocal(JSON.parse(readFileSync(path, "utf-8")));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(patch: Partial<CompanionConfig>): CompanionConfig {
  const prev = loadConfig();
  const next = coerceLocal({
    ...prev,
    ...patch,
    behavior: { ...prev.behavior, ...patch.behavior },
    motion_slots: patch.motion_slots ?? prev.motion_slots,
    models: patch.models ?? prev.models,
    motion_library: patch.motion_library ?? prev.motion_library,
  });
  ensureCompanionDataDir();
  writeFileSync(companionConfigPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function habitatUrlFromConfig(): string {
  return loadConfig().habitat_url?.replace(/\/$/, "") || HABITAT_URL;
}

/** 桌面壳 Habitat token（同步读本地 settings） */
export function remoteAuthTokenFromShell(): string | undefined {
  const shell = loadShellClientConfig();
  const token = shell?.remoteAuthToken?.trim();
  return token || undefined;
}

export type { CompanionBehavior };
