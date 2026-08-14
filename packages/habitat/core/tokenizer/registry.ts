import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getRegistryPath, getTokenizersRootDir } from "./paths.ts";
import seedRegistryJson from "../data/seed-registry.json" with { type: "json" };

export type TokenizerRegistry = Record<string, string>;

function parseRegistryJson(raw: unknown): TokenizerRegistry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TokenizerRegistry = {};
  for (const [model, repo] of Object.entries(raw)) {
    if (typeof repo === "string" && repo.includes("/")) {
      out[model] = repo;
    }
  }
  return out;
}

export function loadSeedRegistry(): TokenizerRegistry {
  return parseRegistryJson(seedRegistryJson);
}

/** User overrides at ~/.anima/tokenizers/registry.json */
export function loadUserRegistry(): TokenizerRegistry {
  try {
    return parseRegistryJson(JSON.parse(readFileSync(getRegistryPath(), "utf-8")) as unknown);
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
