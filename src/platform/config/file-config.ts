import { writeFileSync } from "node:fs";
import { Config, type AnimaConfig, animaConfigSchema } from "@freeanima/core/config";
import { stringifyYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { loadConfigYamlRecord } from "./yaml-io.ts";

function readConfigFromDisk(): AnimaConfig {
  const merged: Record<string, unknown> = { ...loadConfigYamlRecord() };
  const parsed = animaConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid config.yaml: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** File-backed config: read / reload / patch config.yaml（测试与兼容） */
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
    const raw = loadConfigYamlRecord();
    const existing =
      typeof raw[section] === "object" && raw[section] != null && !Array.isArray(raw[section])
        ? (raw[section] as Record<string, unknown>)
        : {};
    const merged = { ...existing, ...patch };
    raw[section] = merged;
    writeFileSync(PATHS.configYaml, stringifyYaml(raw), "utf-8");
    return this.reload();
  }
}
