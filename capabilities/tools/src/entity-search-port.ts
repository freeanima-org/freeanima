import type { EntitySearchPort } from "@freeanima/core/repos";

let searchPort: EntitySearchPort | null = null;
let resolveAccessibleWorldIds: (() => Promise<number[]>) | null = null;

export function registerEntitySearchModule(opts: {
  search: EntitySearchPort;
  resolveAccessibleWorldIds?: () => Promise<number[]>;
}): void {
  searchPort = opts.search;
  resolveAccessibleWorldIds = opts.resolveAccessibleWorldIds ?? null;
}

export function getEntitySearchStore(): EntitySearchPort {
  if (!searchPort) throw new Error("entity search module not registered");
  return searchPort;
}

export async function resolveGlobalAccessibleWorldIds(): Promise<number[]> {
  if (!resolveAccessibleWorldIds) {
    throw new Error("global entity search resolver not configured");
  }
  return resolveAccessibleWorldIds();
}

export function resetEntitySearchModuleForTests(): void {
  searchPort = null;
  resolveAccessibleWorldIds = null;
}
