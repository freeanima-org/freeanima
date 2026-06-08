import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseYaml, stringifyYaml } from "./yaml.ts";
import { CREDENTIAL_MAP, PATHS } from "./paths.ts";
import { expandConfigEnv } from "./env-expand.ts";
import { nestConfigSchema, type NestConfig } from "./schemas/config.ts";
import { OPENAI_COMPATIBLE_BACKEND_ID } from "./schemas/llm-config.ts";
import { credential } from "./credential.ts";

let cache: NestConfig | null = null;

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

function injectLlmProviderCredentials(merged: Record<string, unknown>): void {
  const llm = merged.llm;
  if (!llm || typeof llm !== "object" || Array.isArray(llm)) return;

  const providers = (llm as Record<string, unknown>).providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) return;

  const passPath = CREDENTIAL_MAP.llm_api_key ?? CREDENTIAL_MAP.api_key;
  if (!passPath) return;

  let token: string | undefined;
  try {
    token = credential(passPath, "token");
  } catch {
    return;
  }

  for (const raw of Object.values(providers as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const prov = raw as Record<string, unknown>;
    if (prov.backend !== OPENAI_COMPATIBLE_BACKEND_ID) continue;
    const key = prov.api_key;
    if (typeof key === "string" && key.trim()) continue;
    prov.api_key = token;
  }
}

export function loadConfig(): NestConfig {
  if (cache) return cache;

  const merged: Record<string, unknown> = { ...loadYamlFile(PATHS.configYaml) };
  injectLlmProviderCredentials(merged);

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

export { sanitizeConfigForApi } from "./config-sanitize.ts";

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
