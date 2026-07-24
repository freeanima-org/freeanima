import { join } from "node:path";
import type { Alias } from "vite";

/** 与 tsconfig.base.json paths 手动对齐 */
export const MODULE_ALIAS_RULES = {
  freeanima: "@freeanima/* → src/*",
  paraglide: "@paraglide/* → messages/paraglide/*",
} as const;

export function tsconfigPathEntries(): Record<string, string[]> {
  return {
    "@freeanima/*": ["./src/*"],
    "@paraglide/*": ["./messages/paraglide/*"],
  };
}

export type BuildViteAliasesOptions = {
  repoRoot: string;
  /** Vite dev/build 时 Paraglide 编译输出；默认 messages/paraglide */
  paraglideDir?: string;
};

/** Vite resolve.alias — 与 TS paths 同一语义 */
export function buildViteAliases(opts: BuildViteAliasesOptions): Alias[] {
  const srcRoot = join(opts.repoRoot, "src");
  const paraglideDir = opts.paraglideDir ?? join(opts.repoRoot, "messages/paraglide");
  return [
    { find: /^@freeanima\/(.*)$/, replacement: `${srcRoot}/$1` },
    { find: /^@paraglide\/(.*)$/, replacement: `${paraglideDir}/$1` },
    { find: /^(.*)messages\/paraglide\/(.*)$/, replacement: `${paraglideDir}/$2` },
  ];
}
