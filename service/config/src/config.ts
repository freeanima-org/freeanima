import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseYaml, stringifyYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { expandConfigEnv } from "./env-expand.ts";
import { animaConfigSchema, type AnimaConfig } from "./schemas/config.ts";

let cache: AnimaConfig | null = null;

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

export function loadConfig(): AnimaConfig {
  if (cache) return cache;

  const merged: Record<string, unknown> = { ...loadYamlFile(PATHS.configYaml) };

  const parsed = animaConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid config.yaml: ${parsed.error.message}`);
  }
  cache = parsed.data;
  return cache;
}

export function reloadConfig(): AnimaConfig {
  cache = null;
  return loadConfig();
}

export function clearConfigCache(): void {
  cache = null;
}

export { sanitizeConfigForApi } from "./config-sanitize.ts";

/** 合并写入 config.yaml 某一段（如 discord / weixin） */
export function patchConfigSection(
  section: keyof AnimaConfig | string,
  patch: Record<string, unknown>,
): void {
  const raw = loadYamlFile(PATHS.configYaml);
  const existing =
    typeof raw[section] === "object" && raw[section] !== null && !Array.isArray(raw[section])
      ? (raw[section] as Record<string, unknown>)
      : {};
  const merged = { ...existing, ...patch };
  raw[section] = merged;
  writeFileSync(PATHS.configYaml, stringifyYaml(raw), "utf-8");
  clearConfigCache();
  const validated = animaConfigSchema.safeParse(loadYamlFile(PATHS.configYaml));
  if (!validated.success) {
    throw new Error(`config patch produced invalid config: ${validated.error.message}`);
  }
}
