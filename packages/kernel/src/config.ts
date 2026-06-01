import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { CREDENTIAL_MAP, PATHS } from "./paths.js";
import { nestConfigSchema, type NestConfig } from "./schemas/config.js";
import { credential } from "./credential.js";

let cache: NestConfig | null = null;

function loadYamlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    const data = parseYaml(raw);
    return typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function loadConfig(): NestConfig {
  if (cache) return cache;

  const merged: Record<string, unknown> = { ...loadYamlFile(PATHS.configYaml) };

  if (!merged.api_key && CREDENTIAL_MAP.api_key) {
    try {
      merged.api_key = credential(CREDENTIAL_MAP.api_key, "token");
    } catch {
      // optional at startup
    }
  }

  if (!merged.model) merged.model = "deepseek-v4-flash";

  const parsed = nestConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid config.yaml: ${parsed.error.message}`);
  }
  cache = parsed.data;
  return cache;
}

export function reloadConfig(): NestConfig {
  cache = null;
  return loadConfig();
}

export function clearConfigCache(): void {
  cache = null;
}

export { sanitizeConfigForApi } from "./config-sanitize.js";

/** 合并写入 config.yaml 某一段（如 discord / weixin） */
export function patchConfigSection(
  section: keyof NestConfig | string,
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
  const validated = nestConfigSchema.safeParse(loadYamlFile(PATHS.configYaml));
  if (!validated.success) {
    throw new Error(`config patch produced invalid config: ${validated.error.message}`);
  }
}
