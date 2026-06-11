import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getRegistryPath, getTokenizersRootDir } from "./paths.ts";

export type TokenizerRegistry = Record<string, string>;

export function loadRegistry(): TokenizerRegistry {
  try {
    const raw = readFileSync(getRegistryPath(), "utf-8");
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

export function saveRegistryEntry(model: string, repo: string): void {
  const registry = loadRegistry();
  registry[model] = repo;
  mkdirSync(getTokenizersRootDir(), { recursive: true });
  writeFileSync(getRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}
