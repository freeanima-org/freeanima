import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Config, type AnimaConfig, animaConfigSchema } from "@freeanima/core/config";
import { parseYaml, stringifyYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { expandConfigEnv } from "./env-expand.ts";

function loadYamlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = expandConfigEnv(readFileSync(path, "utf-8"));
    const data = parseYaml(raw);
    return typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readConfigFromDisk(): AnimaConfig {
  const merged: Record<string, unknown> = { ...loadYamlFile(PATHS.configYaml) };
  const parsed = animaConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid config.yaml: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** File-backed config: read / reload / patch config.yaml */
export class FileConfig extends Config {
  /** Startup: read disk + Zod validate + env expand */
  static open(): FileConfig {
    return new FileConfig(readConfigFromDisk());
  }

  /** Re-read config.yaml and update in-memory snapshot */
  reload(): AnimaConfig {
    const next = readConfigFromDisk();
    this.update(next);
    return next;
  }

  /** Merge-write a config.yaml section then reload */
  patchSection(section: keyof AnimaConfig | string, patch: Record<string, unknown>): AnimaConfig {
    const raw = loadYamlFile(PATHS.configYaml);
    const existing =
      typeof raw[section] === "object" && raw[section] !== null && !Array.isArray(raw[section])
        ? (raw[section] as Record<string, unknown>)
        : {};
    const merged = { ...existing, ...patch };
    raw[section] = merged;
    writeFileSync(PATHS.configYaml, stringifyYaml(raw), "utf-8");
    return this.reload();
  }
}
