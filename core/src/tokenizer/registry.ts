import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getRegistryPath, getTokenizersRootDir } from "./paths.ts";

export type TokenizerRegistry = Record<string, string>;

const SEED_REGISTRY_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/seed-registry.json",
);

function parseRegistryJson(raw: string): TokenizerRegistry {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: TokenizerRegistry = {};
    for (const [model, repo] of Object.entries(parsed)) {
      if (typeof repo === "string" && repo.includes("/")) {
        out[model] = repo;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function loadSeedRegistry(): TokenizerRegistry {
  try {
    return parseRegistryJson(readFileSync(SEED_REGISTRY_PATH, "utf-8"));
  } catch {
    return {};
  }
}

/** User overrides at ~/.anima/tokenizers/registry.json */
export function loadUserRegistry(): TokenizerRegistry {
  try {
    return parseRegistryJson(readFileSync(getRegistryPath(), "utf-8"));
  } catch {
    return {};
  }
}

/** Seed first, user registry overrides seed entries. */
export function loadRegistry(): TokenizerRegistry {
  return { ...loadSeedRegistry(), ...loadUserRegistry() };
}

export function saveRegistryEntry(model: string, repo: string): void {
  const registry = loadUserRegistry();
  registry[model] = repo;
  mkdirSync(getTokenizersRootDir(), { recursive: true });
  writeFileSync(getRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}

export function deleteRegistryEntry(model: string): void {
  const registry = loadUserRegistry();
  if (!(model in registry)) return;
  delete registry[model];
  mkdirSync(getTokenizersRootDir(), { recursive: true });
  if (Object.keys(registry).length === 0) {
    writeFileSync(getRegistryPath(), "{}\n", "utf-8");
  } else {
    writeFileSync(getRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
  }
}
