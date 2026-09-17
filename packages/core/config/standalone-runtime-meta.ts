import type { ComponentBuildMeta } from "./build-meta.parse.ts";

export type StandaloneRuntimeMeta = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

const GLOBAL_KEY = "__FREEANIMA_STANDALONE_RUNTIME_META__";

type GlobalWithMeta = typeof globalThis & {
  [GLOBAL_KEY]?: StandaloneRuntimeMeta | null;
};

export function registerStandaloneRuntimeMeta(meta: StandaloneRuntimeMeta): void {
  (globalThis as GlobalWithMeta)[GLOBAL_KEY] = meta;
}

export function getStandaloneRuntimeMeta(): StandaloneRuntimeMeta | null {
  return (globalThis as GlobalWithMeta)[GLOBAL_KEY] ?? null;
}

export function resetStandaloneRuntimeMetaForTests(): void {
  delete (globalThis as GlobalWithMeta)[GLOBAL_KEY];
}
