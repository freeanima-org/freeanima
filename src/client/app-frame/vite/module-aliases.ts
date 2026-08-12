import { join } from "node:path";
import type { Alias } from "vite";

/** 与 tsconfig.base.json paths 手动对齐 */
export const MODULE_ALIAS_RULES = {
  freeanima: "@freeanima/* → src/*",
} as const;

export function tsconfigPathEntries(): Record<string, string[]> {
  return {
    "@freeanima/*": ["./src/*"],
  };
}

export type BuildViteAliasesOptions = {
  repoRoot: string;
};

/** Vite resolve.alias — 与 TS paths 同一语义 */
export function buildViteAliases(opts: BuildViteAliasesOptions): Alias[] {
  const srcRoot = join(opts.repoRoot, "src");
  return [{ find: /^@freeanima\/(.*)$/, replacement: `${srcRoot}/$1` }];
}
